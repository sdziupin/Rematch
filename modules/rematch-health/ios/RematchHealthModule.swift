import ExpoModulesCore
import HealthKit

/// A finished REMATCH session, as JavaScript hands it over. Times are epoch milliseconds.
struct WorkoutRecord: Record {
  @Field var start: Double = 0
  @Field var end: Double = 0
  @Field var activity: String = "hiit"
  @Field var energyKcal: Double? = nil
  /// [pausedAt, resumedAt] pairs; a pause with no resume runs to `end`.
  @Field var pauses: [[Double]] = []
  @Field var externalId: String = ""
  @Field var title: String = ""
}

public class RematchHealthModule: Module {
  private lazy var store = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("RematchHealth")

    Function("isAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    Function("getAvailability") { () -> String in
      HKHealthStore.isHealthDataAvailable() ? "available" : "unsupported"
    }

    /// Only write access can be checked: HealthKit never says whether reading was allowed.
    Function("getAuthorizationStatus") { () -> String in
      self.workoutStatus()
    }

    AsyncFunction("requestAuthorization") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.resolve("unavailable")
        return
      }
      var share: Set<HKSampleType> = [HKObjectType.workoutType()]
      if let energy = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
        share.insert(energy)
      }
      var read: Set<HKObjectType> = []
      if let mass = HKQuantityType.quantityType(forIdentifier: .bodyMass) {
        read.insert(mass)
      }
      if let heartRate = HKQuantityType.quantityType(forIdentifier: .heartRate) {
        read.insert(heartRate)
      }
      self.store.requestAuthorization(toShare: share, read: read) { _, error in
        if let error = error {
          promise.reject("ERR_HEALTH_AUTH", error.localizedDescription)
          return
        }
        promise.resolve(self.workoutStatus())
      }
    }

    /// Most recent body mass in kilograms, or nil when there is none (or reading isn't allowed).
    AsyncFunction("getBodyMassKg") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable(),
            let mass = HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
        promise.resolve(nil as Double?)
        return
      }
      let newest = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
      let query = HKSampleQuery(sampleType: mass, predicate: nil, limit: 1, sortDescriptors: [newest]) { _, samples, _ in
        let kg = (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: .gramUnit(with: .kilo))
        promise.resolve(kg)
      }
      self.store.execute(query)
    }

    /// Average, highest and lowest heart rate between two epoch-ms instants, or nil when there is no
    /// data (HealthKit also reports "no data" when reading isn't allowed).
    AsyncFunction("getHeartRate") { (start: Double, end: Double, promise: Promise) in
      self.heartRate(from: start, to: end, promise: promise)
    }

    AsyncFunction("saveWorkout") { (workout: WorkoutRecord, promise: Promise) in
      self.save(workout, promise: promise)
    }

    AsyncFunction("deleteWorkout") { (id: String, externalId: String, promise: Promise) in
      self.deleteWorkout(id: id, externalId: externalId, promise: promise)
    }

    /// There is no public URL into the Health app's per-app settings; JavaScript opens the Health app itself.
    AsyncFunction("openSettings") { () -> Bool in
      false
    }
  }

  private func workoutStatus() -> String {
    guard HKHealthStore.isHealthDataAvailable() else { return "unavailable" }
    switch store.authorizationStatus(for: HKObjectType.workoutType()) {
    case .sharingAuthorized: return "authorized"
    case .sharingDenied: return "denied"
    default: return "notDetermined"
    }
  }

  private static func activityType(_ name: String) -> HKWorkoutActivityType {
    switch name {
    case "functionalStrength": return .functionalStrengthTraining
    case "traditionalStrength": return .traditionalStrengthTraining
    case "coreTraining": return .coreTraining
    case "flexibility": return .flexibility
    case "mixedCardio": return .mixedCardio
    case "crossTraining": return .crossTraining
    case "jumpRope": return .jumpRope
    case "warmup": return .preparationAndRecovery
    case "cooldown": return .cooldown
    default: return .highIntensityIntervalTraining
    }
  }

  // MARK: - Heart rate

  private func heartRate(from startMs: Double, to endMs: Double, promise: Promise) {
    let start = Date(timeIntervalSince1970: startMs / 1000)
    let end = Date(timeIntervalSince1970: endMs / 1000)
    guard HKHealthStore.isHealthDataAvailable(),
          end > start,
          let heartRate = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
      promise.resolve(nil as [String: Int]?)
      return
    }
    let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
    let query = HKStatisticsQuery(
      quantityType: heartRate,
      quantitySamplePredicate: predicate,
      options: [.discreteAverage, .discreteMax, .discreteMin]
    ) { _, statistics, _ in
      // An error here means "no data" or "not allowed"; both read as nothing to show.
      let bpm = HKUnit.count().unitDivided(by: .minute())
      guard let statistics = statistics,
            let average = statistics.averageQuantity()?.doubleValue(for: bpm),
            let maximum = statistics.maximumQuantity()?.doubleValue(for: bpm),
            let minimum = statistics.minimumQuantity()?.doubleValue(for: bpm) else {
        promise.resolve(nil as [String: Int]?)
        return
      }
      promise.resolve([
        "avgBpm": Int(average.rounded()),
        "maxBpm": Int(maximum.rounded()),
        "minBpm": Int(minimum.rounded()),
      ])
    }
    store.execute(query)
  }

  // MARK: - Saving

  private func save(_ workout: WorkoutRecord, promise: Promise) {
    guard HKHealthStore.isHealthDataAvailable() else {
      promise.reject("ERR_HEALTH_UNAVAILABLE", "Health data is not available on this device.")
      return
    }
    let start = Date(timeIntervalSince1970: workout.start / 1000)
    let end = Date(timeIntervalSince1970: workout.end / 1000)
    guard end > start else {
      promise.reject("ERR_HEALTH_RANGE", "A workout must end after it starts.")
      return
    }
    guard !workout.externalId.isEmpty else {
      build(workout, start: start, end: end, promise: promise)
      return
    }
    // Saving is idempotent: JavaScript may hand over a session again (for example when it backfills after a
    // restore), and HealthKit has no upsert, so a workout this app already saved for that session is reused.
    queryWorkouts(matching: savedByThisApp(externalId: workout.externalId)) { existing, error in
      if let error = error {
        promise.reject("ERR_HEALTH_SAVE", error.localizedDescription)
        return
      }
      if let saved = existing.first {
        promise.resolve(saved.uuid.uuidString)
        return
      }
      self.build(workout, start: start, end: end, promise: promise)
    }
  }

  private func build(_ workout: WorkoutRecord, start: Date, end: Date, promise: Promise) {
    let configuration = HKWorkoutConfiguration()
    configuration.activityType = Self.activityType(workout.activity)
    configuration.locationType = .indoor
    let builder = HKWorkoutBuilder(healthStore: store, configuration: configuration, device: .local())

    var events: [HKWorkoutEvent] = []
    for pair in workout.pauses where pair.count >= 1 {
      let paused = Date(timeIntervalSince1970: pair[0] / 1000)
      guard paused > start, paused < end else { continue }
      events.append(HKWorkoutEvent(type: .pause, dateInterval: DateInterval(start: paused, duration: 0), metadata: nil))
      if pair.count >= 2 {
        let resumed = Date(timeIntervalSince1970: pair[1] / 1000)
        if resumed > paused, resumed < end {
          events.append(HKWorkoutEvent(type: .resume, dateInterval: DateInterval(start: resumed, duration: 0), metadata: nil))
        }
      }
    }

    var metadata: [String: Any] = [HKMetadataKeyIndoorWorkout: true]
    if !workout.externalId.isEmpty { metadata[HKMetadataKeyExternalUUID] = workout.externalId }
    if !workout.title.isEmpty { metadata[HKMetadataKeyWorkoutBrandName] = workout.title }

    var samples: [HKSample] = []
    if let kcal = workout.energyKcal, kcal > 0,
       let energy = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned),
       store.authorizationStatus(for: energy) == .sharingAuthorized {
      samples.append(HKQuantitySample(type: energy, quantity: HKQuantity(unit: .kilocalorie(), doubleValue: kcal), start: start, end: end))
    }

    let fail: (Error?) -> Void = { error in
      builder.discardWorkout()
      promise.reject("ERR_HEALTH_SAVE", error?.localizedDescription ?? "The workout could not be saved.")
    }

    builder.beginCollection(withStart: start) { ok, error in
      guard ok else { return fail(error) }
      // Energy and pauses are extras: the workout is still worth saving without them.
      builder.add(samples) { _, _ in
        builder.addWorkoutEvents(events) { _, _ in
          builder.addMetadata(metadata) { _, _ in
            builder.endCollection(withEnd: end) { ok, error in
              guard ok else { return fail(error) }
              builder.finishWorkout { saved, error in
                guard let saved = saved else { return fail(error) }
                promise.resolve(saved.uuid.uuidString)
              }
            }
          }
        }
      }
    }
  }

  // MARK: - Deleting

  /// Deletes the workout with this UUID or, failing that, every workout this app saved with this external id,
  /// together with the energy samples that were saved with it.
  private func deleteWorkout(id: String, externalId: String, promise: Promise) {
    guard HKHealthStore.isHealthDataAvailable() else {
      promise.resolve(false)
      return
    }
    findWorkouts(id: id, externalId: externalId) { workouts, error in
      if let error = error {
        promise.reject("ERR_HEALTH_DELETE", error.localizedDescription)
        return
      }
      guard !workouts.isEmpty else {
        promise.resolve(false)
        return
      }
      self.delete(workouts, promise: promise)
    }
  }

  private func findWorkouts(id: String, externalId: String, completion: @escaping ([HKWorkout], Error?) -> Void) {
    let byExternalId: () -> Void = {
      guard !externalId.isEmpty else { return completion([], nil) }
      self.queryWorkouts(matching: self.savedByThisApp(externalId: externalId), completion: completion)
    }
    guard let uuid = UUID(uuidString: id) else { return byExternalId() }
    queryWorkouts(matching: HKQuery.predicateForObject(with: uuid)) { workouts, error in
      if let error = error { return completion([], error) }
      if workouts.isEmpty { byExternalId() } else { completion(workouts, nil) }
    }
  }

  /// Workouts this app saved for one REMATCH session.
  private func savedByThisApp(externalId: String) -> NSPredicate {
    NSCompoundPredicate(andPredicateWithSubpredicates: [
      HKQuery.predicateForObjects(withMetadataKey: HKMetadataKeyExternalUUID, allowedValues: [externalId]),
      HKQuery.predicateForObjects(from: HKSource.default()),
    ])
  }

  /// With write-only access HealthKit still returns the workouts this app saved itself.
  private func queryWorkouts(matching predicate: NSPredicate, completion: @escaping ([HKWorkout], Error?) -> Void) {
    let query = HKSampleQuery(
      sampleType: HKObjectType.workoutType(),
      predicate: predicate,
      limit: HKObjectQueryNoLimit,
      sortDescriptors: nil
    ) { _, samples, error in
      completion(samples?.compactMap { $0 as? HKWorkout } ?? [], error)
    }
    store.execute(query)
  }

  /// Deletes the workouts one after another; resolves true after the last one, rejects on the first failure.
  private func delete(_ workouts: [HKWorkout], promise: Promise) {
    guard let workout = workouts.first else {
      promise.resolve(true)
      return
    }
    let rest = Array(workouts.dropFirst())
    deleteEnergy(of: workout) { error in
      if let error = error {
        promise.reject("ERR_HEALTH_DELETE", error.localizedDescription)
        return
      }
      self.store.delete(workout) { ok, error in
        guard ok else {
          promise.reject("ERR_HEALTH_DELETE", error?.localizedDescription ?? "The workout could not be deleted.")
          return
        }
        self.delete(rest, promise: promise)
      }
    }
  }

  /// Deleting a workout leaves its samples behind, so the energy saved with it goes first.
  /// Energy is only ever saved while sharing it is authorized, so without that there is nothing of ours to delete.
  private func deleteEnergy(of workout: HKWorkout, completion: @escaping (Error?) -> Void) {
    guard let energy = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned),
          store.authorizationStatus(for: energy) == .sharingAuthorized else {
      completion(nil)
      return
    }
    store.deleteObjects(of: energy, predicate: HKQuery.predicateForObjects(from: workout)) { _, _, error in
      if let error = error, (error as? HKError)?.code != .errorNoData {
        completion(error)
      } else {
        completion(nil)
      }
    }
  }
}
