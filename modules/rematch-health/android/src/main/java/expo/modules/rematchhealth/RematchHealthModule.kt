package expo.modules.rematchhealth

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.ExerciseSegment
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Device
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Energy
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.interfaces.permissions.PermissionsResponseListener
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import kotlin.coroutines.cancellation.CancellationException
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

/**
 * Health Connect side of the REMATCH Health bridge (the iOS side is HealthKit). Every function catches its own
 * failures: it either resolves the "nothing" value the JS contract allows (null/false) or rejects with ERR_HEALTH_*.
 */
class RematchHealthModule : Module() {
  @Volatile private var client: HealthConnectClient? = null
  private var permissionLauncher: AppContextActivityResultLauncher<ArrayList<String>, Set<String>>? = null

  override fun definition() = ModuleDefinition {
    Name("RematchHealth")

    RegisterActivityContracts {
      this@RematchHealthModule.permissionLauncher = registerForActivityResult(HealthPermissionsContract())
    }

    Function("isAvailable") {
      availability() == AVAILABLE
    }

    Function("getAvailability") {
      availability()
    }

    AsyncFunction("getAuthorizationStatus") Coroutine { ->
      authorizationStatus()
    }

    AsyncFunction("requestAuthorization") Coroutine { ->
      requestAuthorization()
    }

    AsyncFunction("getBodyMassKg") Coroutine { ->
      bodyMassKg()
    }

    AsyncFunction("getHeartRate") Coroutine { start: Double, end: Double ->
      heartRate(start, end)
    }

    AsyncFunction("saveWorkout") Coroutine { workout: WorkoutRecord ->
      saveWorkout(workout)
    }

    AsyncFunction("deleteWorkout") Coroutine { id: String, externalId: String ->
      deleteWorkout(id, externalId)
    }

    AsyncFunction("openSettings") {
      openSettings()
    }
  }

  // region Availability and permissions

  private fun availability(): String {
    val context = appContext.reactContext ?: return UNSUPPORTED
    // Health Connect (the app) supports Android 9+; from Android 14 it is part of the system.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return UNSUPPORTED
    return try {
      when (HealthConnectClient.getSdkStatus(context)) {
        HealthConnectClient.SDK_AVAILABLE -> AVAILABLE
        // Below Android 14 this status means the Health Connect app is missing or too old.
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ->
          if (isProviderInstalled(context)) NEEDS_UPDATE else NOT_INSTALLED
        // Too old an Android, a work profile, or Android 14+ without the service.
        else -> UNSUPPORTED
      }
    } catch (e: Exception) {
      Log.w(TAG, "Could not check whether Health Connect is available", e)
      UNSUPPORTED
    }
  }

  @Suppress("DEPRECATION") // getPackageInfo(String, Int) is deprecated from Android 13, still fine for a lookup.
  private fun isProviderInstalled(context: Context): Boolean =
    try {
      context.packageManager.getPackageInfo(PROVIDER_PACKAGE, 0)
      true
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }

  private fun healthClient(): HealthConnectClient {
    client?.let { return it }
    val context = appContext.reactContext
    if (context == null || availability() != AVAILABLE) {
      throw CodedException(ERR_UNAVAILABLE, "Health Connect is not available on this device.", null)
    }
    return HealthConnectClient.getOrCreate(context).also { client = it }
  }

  private suspend fun grantedPermissions(): Set<String> =
    healthClient().permissionController.getGrantedPermissions()

  /** Health Connect can't tell "never asked" from "said no", so without the grant the answer is notDetermined. */
  private suspend fun authorizationStatus(): String {
    if (availability() != AVAILABLE) return STATUS_UNAVAILABLE
    return try {
      if (grantedPermissions().contains(WRITE_EXERCISE)) STATUS_AUTHORIZED else STATUS_NOT_DETERMINED
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      Log.w(TAG, "Could not read the granted Health Connect permissions", e)
      STATUS_NOT_DETERMINED
    }
  }

  private suspend fun requestAuthorization(): String {
    if (availability() != AVAILABLE) return STATUS_UNAVAILABLE
    try {
      if (!grantedPermissions().containsAll(PERMISSIONS)) {
        askForPermissions(PERMISSIONS)
      }
      // Ask again rather than trusting the screen's result: it only lists what this request granted.
      return if (grantedPermissions().contains(WRITE_EXERCISE)) STATUS_AUTHORIZED else STATUS_DENIED
    } catch (e: CancellationException) {
      throw e
    } catch (e: CodedException) {
      throw e
    } catch (e: Exception) {
      throw CodedException(ERR_AUTH, e.message ?: "Health Connect permissions could not be requested.", e)
    }
  }

  /**
   * Shows Health Connect's permission screen and returns once it is closed.
   *
   * Android 14+ asks for health permissions like any runtime permission (Health Connect's own contract builds a
   * RequestMultiplePermissions intent there). Expo's activity-result registry would send that through
   * ActivityCompat.requestPermissions and never get the answer, which arrives in onRequestPermissionsResult, so on
   * Android 14+ the request goes through Expo's permission service, which does receive it. Android 13 and lower start
   * the Health Connect app for a result, which is what the activity-result registry is for.
   */
  private suspend fun askForPermissions(permissions: List<String>) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val service = appContext.permissions
        ?: throw CodedException(ERR_AUTH, "Expo's permission service is not available.", null)
      suspendCancellableCoroutine<Unit> { continuation ->
        service.askForPermissions(
          PermissionsResponseListener { if (continuation.isActive) continuation.resume(Unit) },
          *permissions.toTypedArray()
        )
      }
    } else {
      val launcher = permissionLauncher
        ?: throw CodedException(ERR_AUTH, "There is no activity to show the Health Connect permission screen from.", null)
      withContext(Dispatchers.Main) {
        launcher.launch(ArrayList(permissions))
      }
    }
  }

  // endregion

  // region Reading

  /** Newest weight in kilograms, or null when there is none or reading it isn't allowed. */
  private suspend fun bodyMassKg(): Double? {
    if (availability() != AVAILABLE) return null
    return try {
      val client = healthClient()
      if (!client.permissionController.getGrantedPermissions().contains(READ_WEIGHT)) return null
      val now = Instant.now()
      val response = client.readRecords(
        ReadRecordsRequest(
          recordType = WeightRecord::class,
          timeRangeFilter = TimeRangeFilter.between(now.minus(WEIGHT_LOOKBACK), now),
          dataOriginFilter = emptySet(),
          ascendingOrder = false,
          pageSize = 1,
          pageToken = null,
        )
      )
      response.records.firstOrNull()?.weight?.inKilograms
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      Log.w(TAG, "Could not read the body weight", e)
      null
    }
  }

  /** Average, highest and lowest heart rate in the interval, or null when there is none or reading it isn't allowed. */
  private suspend fun heartRate(startMs: Double, endMs: Double): Map<String, Int>? {
    val start = Instant.ofEpochMilli(startMs.toLong())
    val end = Instant.ofEpochMilli(endMs.toLong())
    if (!end.isAfter(start) || availability() != AVAILABLE) return null
    return try {
      val client = healthClient()
      if (!client.permissionController.getGrantedPermissions().contains(READ_HEART_RATE)) return null
      val result = client.aggregate(
        AggregateRequest(
          metrics = setOf(HeartRateRecord.BPM_AVG, HeartRateRecord.BPM_MAX, HeartRateRecord.BPM_MIN),
          timeRangeFilter = TimeRangeFilter.between(start, end),
        )
      )
      val average = result[HeartRateRecord.BPM_AVG] ?: return null
      val maximum = result[HeartRateRecord.BPM_MAX] ?: return null
      val minimum = result[HeartRateRecord.BPM_MIN] ?: return null
      mapOf("avgBpm" to average.toInt(), "maxBpm" to maximum.toInt(), "minBpm" to minimum.toInt())
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      Log.w(TAG, "Could not read the heart rate", e)
      null
    }
  }

  // endregion

  // region Writing

  /**
   * Upserts the session: its client record id is derived from the REMATCH session id, and the version is the save
   * time, so saving the same session again replaces it instead of adding a duplicate. Resolves the record id.
   */
  private suspend fun saveWorkout(workout: WorkoutRecord): String {
    if (availability() != AVAILABLE) {
      throw CodedException(ERR_UNAVAILABLE, "Health Connect is not available on this device.", null)
    }
    val start = Instant.ofEpochMilli(workout.start.toLong())
    val end = Instant.ofEpochMilli(workout.end.toLong())
    if (!end.isAfter(start)) {
      throw CodedException(ERR_RANGE, "A workout must end after it starts.", null)
    }

    try {
      val client = healthClient()
      val granted = client.permissionController.getGrantedPermissions()
      if (!granted.contains(WRITE_EXERCISE)) {
        throw CodedException(ERR_PERMISSION, "REMATCH may not write workouts to Health Connect.", null)
      }

      val zone = ZoneId.systemDefault().rules
      val startOffset = zone.getOffset(start)
      val endOffset = zone.getOffset(end)
      val sessionClientId = sessionClientId(workout.externalId)
      val version = System.currentTimeMillis()

      val session = exerciseSession(workout, start, startOffset, end, endOffset, metadata(sessionClientId, version))
      val recordId = client.insertRecords(listOf(session)).recordIdsList.firstOrNull()

      val kcal = workout.energyKcal ?: 0.0
      if (kcal > 0 && granted.contains(WRITE_ACTIVE_CALORIES)) {
        // The energy estimate is an extra: the workout is still worth keeping without it.
        try {
          val energy = ActiveCaloriesBurnedRecord(
            startTime = start,
            startZoneOffset = startOffset,
            endTime = end,
            endZoneOffset = endOffset,
            energy = Energy.kilocalories(kcal),
            metadata = metadata(sessionClientId?.let { it + ENERGY_SUFFIX }, version),
          )
          client.insertRecords(listOf(energy))
        } catch (e: CancellationException) {
          throw e
        } catch (e: Exception) {
          Log.w(TAG, "Could not save the energy of a workout", e)
        }
      }

      return recordId ?: sessionClientId ?: ""
    } catch (e: CancellationException) {
      throw e
    } catch (e: CodedException) {
      throw e
    } catch (e: SecurityException) {
      throw CodedException(ERR_PERMISSION, e.message ?: "REMATCH may not write workouts to Health Connect.", e)
    } catch (e: Exception) {
      throw CodedException(ERR_SAVE, e.message ?: "The workout could not be saved.", e)
    }
  }

  /**
   * Deletes by client record id, so it also finds a session that was saved again under a new record id.
   * Health Connect doesn't say how many records went away: true means the deletion ran.
   */
  private suspend fun deleteWorkout(id: String, externalId: String): Boolean {
    if (availability() != AVAILABLE) return false
    val sessionClientId = sessionClientId(externalId)
    // Every session saved by saveWorkout has a client record id; the record id only matters without one.
    val recordIds = if (sessionClientId == null && id.isNotEmpty()) listOf(id) else emptyList()
    if (sessionClientId == null && recordIds.isEmpty()) return false

    try {
      val client = healthClient()
      client.deleteRecords(ExerciseSessionRecord::class, recordIds, listOfNotNull(sessionClientId))
      if (sessionClientId != null && client.permissionController.getGrantedPermissions().contains(WRITE_ACTIVE_CALORIES)) {
        client.deleteRecords(ActiveCaloriesBurnedRecord::class, emptyList(), listOf(sessionClientId + ENERGY_SUFFIX))
      }
      return true
    } catch (e: CancellationException) {
      throw e
    } catch (e: CodedException) {
      throw e
    } catch (e: SecurityException) {
      throw CodedException(ERR_PERMISSION, e.message ?: "REMATCH may not delete workouts from Health Connect.", e)
    } catch (e: Exception) {
      throw CodedException(ERR_DELETE, e.message ?: "The workout could not be deleted.", e)
    }
  }

  private fun sessionClientId(externalId: String): String? =
    externalId.takeIf { it.isNotEmpty() }?.let { CLIENT_ID_PREFIX + it }

  /** REMATCH times the workout live on the phone, so the data is "actively recorded" by a phone. */
  private fun metadata(clientRecordId: String?, version: Long): Metadata {
    val device = Device(Device.TYPE_PHONE, Build.MANUFACTURER, Build.MODEL)
    return if (clientRecordId != null) {
      Metadata.activelyRecorded(device, clientRecordId, version)
    } else {
      Metadata.activelyRecorded(device)
    }
  }

  private fun exerciseSession(
    workout: WorkoutRecord,
    start: Instant,
    startOffset: ZoneOffset,
    end: Instant,
    endOffset: ZoneOffset,
    metadata: Metadata,
  ): ExerciseSessionRecord {
    val type = exerciseType(workout.activity)
    val title = workout.title.takeIf { it.isNotBlank() }
    val notes = workout.notes?.takeIf { it.isNotBlank() }
    val pauses = pauseSegments(workout.pauses, start, end)
    if (pauses.isNotEmpty()) {
      try {
        return ExerciseSessionRecord(start, startOffset, end, endOffset, metadata, type, title = title, notes = notes, segments = pauses)
      } catch (e: IllegalArgumentException) {
        // The pauses are an extra, like on iOS: save the workout without them rather than not at all.
        Log.w(TAG, "Saving a workout without its pauses", e)
      }
    }
    return ExerciseSessionRecord(start, startOffset, end, endOffset, metadata, type, title = title, notes = notes)
  }

  /**
   * Pauses become PAUSE segments, which Health Connect accepts in every kind of session. Like on iOS, a pause must
   * start inside the workout and runs to `end` when it has no resume inside the workout. Segments may not overlap,
   * so overlapping pauses are merged.
   */
  private fun pauseSegments(pauses: List<List<Double>>, start: Instant, end: Instant): List<ExerciseSegment> {
    val intervals = pauses.mapNotNull { pair ->
      val paused = Instant.ofEpochMilli((pair.getOrNull(0) ?: return@mapNotNull null).toLong())
      if (!paused.isAfter(start) || !paused.isBefore(end)) return@mapNotNull null
      val resumed = pair.getOrNull(1)?.let { Instant.ofEpochMilli(it.toLong()) }
      val pauseEnd = if (resumed != null && resumed.isAfter(paused) && resumed.isBefore(end)) resumed else end
      paused to pauseEnd
    }.sortedBy { it.first }

    val merged = mutableListOf<Pair<Instant, Instant>>()
    for ((pauseStart, pauseEnd) in intervals) {
      val last = merged.lastOrNull()
      if (last != null && !pauseStart.isAfter(last.second)) {
        merged[merged.lastIndex] = last.first to maxOf(last.second, pauseEnd)
      } else {
        merged.add(pauseStart to pauseEnd)
      }
    }
    return merged.map { (pauseStart, pauseEnd) ->
      ExerciseSegment(pauseStart, pauseEnd, ExerciseSegment.EXERCISE_SEGMENT_TYPE_PAUSE)
    }
  }

  /**
   * REMATCH activity → closest Health Connect exercise type (Health Connect has fewer types than HealthKit):
   * - hiit, mixedCardio (cardio intervals) → HIGH_INTENSITY_INTERVAL_TRAINING
   * - functionalStrength → STRENGTH_TRAINING
   * - traditionalStrength (free weights, machines) → WEIGHTLIFTING
   * - coreTraining (bodyweight core work) → CALISTHENICS
   * - flexibility, warmup, cooldown → STRETCHING
   * - crossTraining (mixed strength and cardio) → BOOT_CAMP
   * - jumpRope → OTHER_WORKOUT (Health Connect has a jump-rope segment type, but no such session type)
   * - anything else → HIGH_INTENSITY_INTERVAL_TRAINING, as on iOS
   */
  private fun exerciseType(activity: String): Int =
    when (activity) {
      "functionalStrength" -> ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING
      "traditionalStrength" -> ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING
      "coreTraining" -> ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS
      "flexibility", "warmup", "cooldown" -> ExerciseSessionRecord.EXERCISE_TYPE_STRETCHING
      "crossTraining" -> ExerciseSessionRecord.EXERCISE_TYPE_BOOT_CAMP
      "jumpRope" -> ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT
      else -> ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING
    }

  // endregion

  // region Settings

  /**
   * Opens Health Connect's screen of REMATCH's permissions (Android 14+), else its data and permission screens, or the
   * Play Store page of Health Connect when it is missing or too old (Android 13 and lower). Resolves false when
   * nothing could be opened.
   */
  private fun openSettings(): Boolean {
    val context = appContext.reactContext ?: return false
    return when (availability()) {
      AVAILABLE -> {
        val appPermissions = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
          startActivity(
            context,
            Intent(ACTION_MANAGE_HEALTH_PERMISSIONS).putExtra(Intent.EXTRA_PACKAGE_NAME, context.packageName)
          )
        appPermissions || try {
          startActivity(context, HealthConnectClient.getHealthConnectManageDataIntent(context))
        } catch (e: Exception) {
          Log.w(TAG, "Could not build the Health Connect settings intent", e)
          false
        }
      }
      NOT_INSTALLED, NEEDS_UPDATE -> {
        val market = Intent(Intent.ACTION_VIEW, Uri.parse(PLAY_STORE_URL)).setPackage(PLAY_STORE_PACKAGE)
        startActivity(context, market) || startActivity(context, Intent(Intent.ACTION_VIEW, Uri.parse(PLAY_STORE_WEB_URL)))
      }
      else -> false
    }
  }

  private fun startActivity(context: Context, intent: Intent): Boolean =
    try {
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      true
    } catch (e: Exception) {
      Log.w(TAG, "Could not open ${intent.action}", e)
      false
    }

  // endregion

  private companion object {
    const val TAG = "RematchHealth"
    const val PROVIDER_PACKAGE = "com.google.android.apps.healthdata"
    const val PLAY_STORE_PACKAGE = "com.android.vending"
    const val PLAY_STORE_URL = "market://details?id=$PROVIDER_PACKAGE&url=healthconnect%3A%2F%2Fonboarding"
    const val PLAY_STORE_WEB_URL = "https://play.google.com/store/apps/details?id=$PROVIDER_PACKAGE"

    /** android.health.connect.HealthConnectManager.ACTION_MANAGE_HEALTH_PERMISSIONS (API 34). */
    const val ACTION_MANAGE_HEALTH_PERMISSIONS = "android.health.connect.action.MANAGE_HEALTH_PERMISSIONS"

    const val CLIENT_ID_PREFIX = "rematch-"
    const val ENERGY_SUFFIX = "-energy"
    val WEIGHT_LOOKBACK: Duration = Duration.ofDays(730)

    const val AVAILABLE = "available"
    const val NOT_INSTALLED = "notInstalled"
    const val NEEDS_UPDATE = "needsUpdate"
    const val UNSUPPORTED = "unsupported"

    const val STATUS_UNAVAILABLE = "unavailable"
    const val STATUS_NOT_DETERMINED = "notDetermined"
    const val STATUS_DENIED = "denied"
    const val STATUS_AUTHORIZED = "authorized"

    const val ERR_UNAVAILABLE = "ERR_HEALTH_UNAVAILABLE"
    const val ERR_AUTH = "ERR_HEALTH_AUTH"
    const val ERR_PERMISSION = "ERR_HEALTH_PERMISSION"
    const val ERR_RANGE = "ERR_HEALTH_RANGE"
    const val ERR_SAVE = "ERR_HEALTH_SAVE"
    const val ERR_DELETE = "ERR_HEALTH_DELETE"

    val WRITE_EXERCISE = HealthPermission.getWritePermission(ExerciseSessionRecord::class)
    val WRITE_ACTIVE_CALORIES = HealthPermission.getWritePermission(ActiveCaloriesBurnedRecord::class)
    val READ_WEIGHT = HealthPermission.getReadPermission(WeightRecord::class)
    val READ_HEART_RATE = HealthPermission.getReadPermission(HeartRateRecord::class)

    /** Must match the uses-permission entries in AndroidManifest.xml. */
    val PERMISSIONS = listOf(WRITE_EXERCISE, WRITE_ACTIVE_CALORIES, READ_WEIGHT, READ_HEART_RATE)
  }
}
