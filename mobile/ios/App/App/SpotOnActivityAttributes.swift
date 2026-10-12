import Foundation
#if canImport(ActivityKit)
import ActivityKit

/// An upload's Live Activity (the Dynamic Island and the lock screen). Shared by the app, which
/// starts and updates it (SpotOnNativePlugin), and the SpotOnWidgets extension, which draws it.
@available(iOS 16.2, *)
struct SpotOnActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// "uploading", "done" or "failed".
        var phase: String
        /// 0–1, or -1 while unknown.
        var progress: Double
        /// The localized status line, from the web app's dictionaries.
        var status: String
    }

    /// The spot's name.
    var title: String
    /// "spot", "photos" or "review".
    var kind: String
}
#endif
