import AVFAudio
import UIKit
import WebKit

/// The game is bundled in the app. No web server or network connection is needed.
final class GameViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    private let saves = NativeSaveStore()
    private var webView: WKWebView!
    private var isActive = false
    private var gameURL: URL?
    private let loading = UIActivityIndicatorView(style: .large)
    private let errorPanel = UIStackView()

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .all }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.067, green: 0.075, blue: 0.137, alpha: 1)
        // Respect silent mode and allow other apps' music to keep playing.
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.userContentController.add(WeakGameMessageHandler(self), name: "parkour")
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.backgroundColor = view.backgroundColor
        webView.scrollView.bounces = false
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        loading.color = .white
        loading.accessibilityLabel = "Loading Parkour Enemies"
        loading.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(loading)
        NSLayoutConstraint.activate([
            loading.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loading.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        buildErrorPanel()
        loadGame()
    }

    func setActive(_ active: Bool) {
        isActive = active
        guard isViewLoaded else { return }
        // Keep the restore script current if WebKit must restart its content process.
        installRestoreScript()
        webView.evaluateJavaScript("window.__PARKOUR_ACTIVE__ = \(active ? "true" : "false");" +
            (active ? "" : "window.parkourNative && window.parkourNative.pause();"), completionHandler: nil)
    }

    private func installRestoreScript() {
        let controller = webView.configuration.userContentController
        controller.removeAllUserScripts()
        controller.addUserScript(WKUserScript(source: saves.injectionScript(isActive: isActive),
                                              injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    private func loadGame() {
        errorPanel.isHidden = true
        webView.isHidden = false
        loading.startAnimating()
        installRestoreScript()
        guard let url = Bundle.main.url(forResource: "parkour-enemies", withExtension: "html", subdirectory: "Game") else {
            showError("The game is missing. Rebuild the app in Xcode.")
            return
        }
        gameURL = url
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.request.url?.standardizedFileURL == gameURL?.standardizedFileURL,
              let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        if type == "storage", let key = body["key"] as? String, let value = body["value"] as? String {
            if saves.set(value, forKey: key) { installRestoreScript() }
        } else if type == "ready" {
            // Scene activation can happen while the document is still loading.
            // Reconcile the live document after its document-start script runs.
            setActive(isActive)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Only the bundled main document may navigate; all artwork is embedded.
        let allowed = navigationAction.targetFrame?.isMainFrame == true &&
            navigationAction.request.url?.standardizedFileURL == gameURL?.standardizedFileURL
        decisionHandler(allowed ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loading.stopAnimating()
        setActive(isActive)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { showError("The game could not load. Try again.") }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { showError("The game could not load. Try again.") }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { loadGame() }

    private func buildErrorPanel() {
        errorPanel.axis = .vertical
        errorPanel.spacing = 20
        errorPanel.alignment = .center
        errorPanel.translatesAutoresizingMaskIntoConstraints = false
        let title = UILabel()
        title.text = "Parkour Enemies"
        title.font = .systemFont(ofSize: 28, weight: .bold)
        title.textColor = .white
        let explanation = UILabel()
        explanation.tag = 1
        explanation.numberOfLines = 0
        explanation.textAlignment = .center
        explanation.textColor = .white
        let retry = UIButton(type: .system)
        retry.setTitle("Try again", for: .normal)
        retry.titleLabel?.font = .systemFont(ofSize: 20, weight: .semibold)
        retry.addTarget(self, action: #selector(retryLoading), for: .touchUpInside)
        [title, explanation, retry].forEach { errorPanel.addArrangedSubview($0) }
        view.addSubview(errorPanel)
        NSLayoutConstraint.activate([
            errorPanel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            errorPanel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            errorPanel.widthAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.widthAnchor, multiplier: 0.8)
        ])
        errorPanel.isHidden = true
    }

    private func showError(_ message: String) {
        loading.stopAnimating()
        webView.isHidden = true
        (errorPanel.viewWithTag(1) as? UILabel)?.text = message
        errorPanel.isHidden = false
    }

    @objc private func retryLoading() { loadGame() }
}

private final class WeakGameMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var delegate: WKScriptMessageHandler?
    init(_ delegate: WKScriptMessageHandler) { self.delegate = delegate }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}
