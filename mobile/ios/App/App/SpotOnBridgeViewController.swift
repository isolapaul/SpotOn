import UIKit
import Capacitor

/// The web view controller: Capacitor's, plus the app's own plugin (SpotOnNativePlugin).
class SpotOnBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SpotOnNativePlugin())
    }
}
