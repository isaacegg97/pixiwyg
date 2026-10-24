package app.pixiwyg

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.os.UserManager
import androidx.activity.enableEdgeToEdge

// SECTION: PIXIWYG's Android activity, and kiosk mode on the profile it administers
// RULE: everywhere, Back steps back through the page's own history first (a dialog, a sheet, the tool to the XMB
//   home), and only then leaves the app.
// RULE: on a profile where PIXIWYG is the profile owner (the "Pixi" kiosk profile, set up over adb), it is the only
//   app: lock-task mode with no Home, Recents or notifications, and it is that profile's home screen. Leaving it locks
//   the tablet, so the next person picks their profile at the lock screen. On every other profile it's a normal app.
class MainActivity : TauriActivity() {
  override val handleBackNavigation: Boolean = true
  private val dpm by lazy { getSystemService(DevicePolicyManager::class.java) }
  private val admin by lazy { ComponentName(this, KioskAdmin::class.java) }
  private val kiosk get() = dpm.isProfileOwnerApp(packageName)

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    if (kiosk) setUpKiosk()
  }

  override fun onResume() {
    super.onResume()
    // SAFETY: lock task only starts on the kiosk profile, where setLockTaskPackages allowed it.
    if (kiosk && dpm.isLockTaskPermitted(packageName)) runCatching { startLockTask() }
  }

  @Deprecated("Called by WryActivity once the page has nothing left to go back to")
  override fun onBackPressed() {
    if (!kiosk) {
      @Suppress("DEPRECATION")
      super.onBackPressed()
      return
    }
    runCatching { stopLockTask() }
    dpm.lockNow()
  }

  private fun setUpKiosk() {
    dpm.setLockTaskPackages(admin, arrayOf(packageName))
    // RULE: the power menu and the lock screen still work, so the tablet can be turned off and locked.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      dpm.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_GLOBAL_ACTIONS or DevicePolicyManager.LOCK_TASK_FEATURE_KEYGUARD)
    }
    val home = IntentFilter(Intent.ACTION_MAIN).apply {
      addCategory(Intent.CATEGORY_HOME)
      addCategory(Intent.CATEGORY_DEFAULT)
    }
    // RULE: the Home alias is off in every profile; only the kiosk turns it on, for itself.
    val alias = ComponentName(packageName, "$packageName.KioskHome")
    packageManager.setComponentEnabledSetting(alias, android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED, android.content.pm.PackageManager.DONT_KILL_APP)
    dpm.addPersistentPreferredActivity(admin, home, alias)
    // FIX: Fire OS keeps its own launcher as home whatever the preference says, so on the kiosk profile every other
    //   launcher and launchable app is hidden (for this profile only); PIXIWYG is then the only home and the only app.
    val pm = packageManager
    val others = (pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0) +
        pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0))
      .map { it.activityInfo.packageName }.toSet() - packageName
    for (p in others) runCatching { dpm.setApplicationHidden(admin, p, true) }
    for (r in listOf(UserManager.DISALLOW_INSTALL_APPS, UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES, UserManager.DISALLOW_UNINSTALL_APPS,
        UserManager.DISALLOW_MODIFY_ACCOUNTS, UserManager.DISALLOW_ADD_USER, UserManager.DISALLOW_SAFE_BOOT)) {
      runCatching { dpm.addUserRestriction(admin, r) }
    }
  }
}
