import SwiftUI
import WidgetKit

/// The app's widget extension: for now only the upload Live Activity.
@main
struct SpotOnWidgetsBundle: WidgetBundle {
    var body: some Widget {
        UploadLiveActivity()
    }
}
