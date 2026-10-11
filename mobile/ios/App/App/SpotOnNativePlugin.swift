import Foundation
import UIKit
import Capacitor
#if canImport(ActivityKit)
import ActivityKit
#endif

/// The app's own plugin (src/store/nativeExtras.ts): upload Live Activities and home-screen quick
/// actions. Registered by SpotOnBridgeViewController.
@objc(SpotOnNativePlugin)
public class SpotOnNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpotOnNativePlugin"
    public let jsName = "SpotOnNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setQuickActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePendingQuickAction", returnType: CAPPluginReturnPromise)
    ]

    /// The quick action that launched the app, until the web app asks for it.
    private static var pendingQuickAction: String?
    private static weak var current: SpotOnNativePlugin?
    /// Running activities by upload id (Activity<SpotOnActivityAttributes>; typed loosely for iOS 15).
    private var activities: [String: Any] = [:]

    override public func load() {
        SpotOnNativePlugin.current = self
    }

    /// A quick action from SceneDelegate: to the web app if it is running, else kept for it.
    static func handleQuickAction(_ type: String) {
        if let plugin = current {
            plugin.notifyListeners("quickAction", data: ["type": type], retainUntilConsumed: true)
        } else {
            pendingQuickAction = type
        }
    }

    @objc func takePendingQuickAction(_ call: CAPPluginCall) {
        var result: [String: Any] = [:]
        if let type = SpotOnNativePlugin.pendingQuickAction { result["type"] = type }
        SpotOnNativePlugin.pendingQuickAction = nil
        call.resolve(result)
    }

    @objc func setQuickActions(_ call: CAPPluginCall) {
        let items = call.getArray("items", JSObject.self) ?? []
        let shortcuts = items.compactMap { item -> UIApplicationShortcutItem? in
            guard let type = item["type"] as? String, let title = item["title"] as? String else { return nil }
            let icon = (item["icon"] as? String).map { UIApplicationShortcutIcon(systemImageName: $0) }
            return UIApplicationShortcutItem(type: type, localizedTitle: title, localizedSubtitle: nil, icon: icon, userInfo: nil)
        }
        DispatchQueue.main.async {
            UIApplication.shared.shortcutItems = shortcuts
            call.resolve()
        }
    }

    // MARK: Live Activities

    private func state(_ call: CAPPluginCall) -> (phase: String, progress: Double, status: String) {
        (call.getString("phase") ?? "uploading", call.getDouble("progress") ?? -1, call.getString("status") ?? "")
    }

    @objc func startActivity(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            guard let id = call.getString("id"), ActivityAuthorizationInfo().areActivitiesEnabled else {
                return call.resolve(["started": false])
            }
            let s = state(call)
            let attributes = SpotOnActivityAttributes(title: call.getString("title") ?? "", kind: call.getString("kind") ?? "spot")
            let content = ActivityContent(
                state: SpotOnActivityAttributes.ContentState(phase: s.phase, progress: s.progress, status: s.status),
                staleDate: nil
            )
            do {
                activities[id] = try Activity.request(attributes: attributes, content: content, pushType: nil)
                return call.resolve(["started": true])
            } catch {
                return call.resolve(["started": false])
            }
        }
        #endif
        call.resolve(["started": false])
    }

    @objc func updateActivity(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *), let id = call.getString("id"),
           let activity = activities[id] as? Activity<SpotOnActivityAttributes> {
            let s = state(call)
            let content = ActivityContent(
                state: SpotOnActivityAttributes.ContentState(phase: s.phase, progress: s.progress, status: s.status),
                staleDate: nil
            )
            Task {
                await activity.update(content)
                call.resolve()
            }
            return
        }
        #endif
        call.resolve()
    }

    @objc func endActivity(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *), let id = call.getString("id"),
           let activity = activities.removeValue(forKey: id) as? Activity<SpotOnActivityAttributes> {
            let s = state(call)
            let content = ActivityContent(
                state: SpotOnActivityAttributes.ContentState(phase: s.phase, progress: s.progress, status: s.status),
                staleDate: nil
            )
            let linger = max(0, call.getDouble("dismissAfter") ?? 8)
            Task {
                await activity.end(content, dismissalPolicy: .after(Date().addingTimeInterval(linger)))
                call.resolve()
            }
            return
        }
        #endif
        call.resolve()
    }
}
