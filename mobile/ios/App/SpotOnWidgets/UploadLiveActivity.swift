import ActivityKit
import SwiftUI
import WidgetKit

/// The brand green (--color-primary-500 / 400 in globals.css).
private let brand = Color(red: 0x16 / 255, green: 0xA0 / 255, blue: 0x64 / 255)
private let brandLight = Color(red: 0x3C / 255, green: 0xCB / 255, blue: 0x8C / 255)

private extension SpotOnActivityAttributes.ContentState {
    var done: Bool { phase == "done" }
    var failed: Bool { phase == "failed" }
    var tint: Color { failed ? .orange : brandLight }
    /// The SF Symbol of the state.
    var symbol: String { done ? "checkmark.circle.fill" : failed ? "exclamationmark.triangle.fill" : "arrow.up.circle.fill" }
}

private extension SpotOnActivityAttributes {
    var kindSymbol: String { kind == "review" ? "star.bubble.fill" : kind == "photos" ? "photo.on.rectangle.angled" : "mappin.and.ellipse" }
}

/// A ring that fills with the upload (spins while the progress is unknown).
private struct ProgressRing: View {
    let state: SpotOnActivityAttributes.ContentState
    var size: CGFloat = 22
    var line: CGFloat = 3

    var body: some View {
        ZStack {
            Circle().stroke(state.tint.opacity(0.25), lineWidth: line)
            if state.done || state.failed {
                Image(systemName: state.symbol)
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(state.tint)
                    .transition(.scale.combined(with: .opacity))
            } else {
                Circle()
                    .trim(from: 0, to: state.progress < 0 ? 0.25 : max(0.04, state.progress))
                    .stroke(state.tint, style: StrokeStyle(lineWidth: line, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
        }
        .frame(width: size, height: size)
    }
}

@available(iOS 16.2, *)
struct UploadLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SpotOnActivityAttributes.self) { context in
            // The lock screen and the banner on iPhones without a Dynamic Island.
            HStack(spacing: 14) {
                ZStack {
                    Circle().fill(brand.opacity(0.18))
                    Image(systemName: context.attributes.kindSymbol).foregroundStyle(brandLight)
                }
                .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 3) {
                    Text(context.attributes.title).font(.headline).lineLimit(1)
                    Text(context.state.status).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                    if !context.state.done && !context.state.failed {
                        ProgressView(value: max(0, context.state.progress))
                            .tint(brandLight)
                            .padding(.top, 2)
                    }
                }
                Spacer(minLength: 0)
                ProgressRing(state: context.state, size: 28, line: 3.5)
            }
            .padding(16)
            .activityBackgroundTint(Color.black.opacity(0.78))
            .activitySystemActionForegroundColor(brandLight)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: context.attributes.kindSymbol)
                        .font(.title2)
                        .foregroundStyle(brandLight)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ProgressRing(state: context.state, size: 30, line: 4).padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.title).font(.headline).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        Text(context.state.status).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                        if !context.state.done && !context.state.failed {
                            ProgressView(value: max(0, context.state.progress)).tint(brandLight)
                        }
                    }
                    .padding(.horizontal, 8)
                }
            } compactLeading: {
                Image(systemName: "mappin.circle.fill").foregroundStyle(brandLight)
            } compactTrailing: {
                ProgressRing(state: context.state, size: 18, line: 2.5)
            } minimal: {
                ProgressRing(state: context.state, size: 18, line: 2.5)
            }
            .keylineTint(brandLight)
        }
    }
}
