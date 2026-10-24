package app.pixiwyg

import android.app.admin.DeviceAdminReceiver

// SECTION: the admin receiver that makes PIXIWYG a profile owner (dpm set-profile-owner over adb, on the kiosk
//   profile only); MainActivity reads that and does the rest.
class KioskAdmin : DeviceAdminReceiver()
