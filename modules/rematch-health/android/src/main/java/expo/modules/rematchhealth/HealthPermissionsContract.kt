package expo.modules.rematchhealth

import android.content.Context
import android.content.Intent
import androidx.health.connect.client.PermissionController
import expo.modules.kotlin.activityresult.AppContextActivityResultContract

/**
 * Health Connect's permission request, adapted to Expo's activity-result API. Used on Android 13 and lower only,
 * where the request is an activity of the Health Connect app (see RematchHealthModule.askForPermissions).
 * The input is an [ArrayList] because Expo persists it across activity recreation and needs it [java.io.Serializable].
 * The output is the set of permissions granted by this request.
 */
internal class HealthPermissionsContract : AppContextActivityResultContract<ArrayList<String>, Set<String>> {
  private val delegate = PermissionController.createRequestPermissionResultContract()

  override fun createIntent(context: Context, input: ArrayList<String>): Intent =
    delegate.createIntent(context, input.toSet())

  override fun parseResult(input: ArrayList<String>, resultCode: Int, intent: Intent?): Set<String> =
    delegate.parseResult(resultCode, intent)
}
