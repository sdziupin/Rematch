package expo.modules.rematchhealth

import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowInsets
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * Explains what REMATCH does with Health Connect data. Health Connect opens it from its permission screens
 * (see AndroidManifest.xml) and refuses to show the permission dialog to apps that don't declare one.
 */
class HealthPermissionsRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val padding = dp(24)
    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(padding, padding, padding, padding)
      addView(
        TextView(this@HealthPermissionsRationaleActivity).apply {
          text = TITLE
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
          setPadding(0, 0, 0, dp(16))
        }
      )
      addView(
        TextView(this@HealthPermissionsRationaleActivity).apply {
          text = BODY
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
          setLineSpacing(0f, 1.25f)
        }
      )
      addView(
        Button(this@HealthPermissionsRationaleActivity).apply {
          text = CLOSE
          setOnClickListener { finish() }
        },
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
          topMargin = dp(24)
          gravity = Gravity.END
        }
      )
    }

    val root = ScrollView(this).apply {
      isFillViewport = true
      addView(content)
    }
    // Android 15+ draws apps edge to edge; keep the text clear of the status and navigation bars.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      root.setOnApplyWindowInsetsListener { view, insets ->
        val bars = insets.getInsets(WindowInsets.Type.systemBars())
        view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
        insets
      }
    }
    setContentView(root)
  }

  private fun dp(value: Int): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()

  private companion object {
    const val TITLE = "REMATCH and Health Connect"
    const val BODY =
      "REMATCH writes each workout you finish to Health Connect: when it started and ended, the kind of " +
        "workout, its pauses, its name and your notes, together with an estimate of the active energy you burned.\n\n" +
        "It reads your weight only to estimate those calories, and your heart rate only to show it on the " +
        "result screen of a workout.\n\n" +
        "Nothing REMATCH reads from or writes to Health Connect leaves your device. You can change or withdraw " +
        "these permissions at any time in Health Connect."
    const val CLOSE = "Close"
  }
}
