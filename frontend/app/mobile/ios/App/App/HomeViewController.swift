//
//  HomeViewController.swift
//  App
//
//  Created by Simon Backx on 19/06/2021.
//

import Foundation
import UIKit
import Capacitor
import WebKit

/**
    We enable the default swipe to go back behaviour in the WKWebView
 */
class HomeViewController: CAPBridgeViewController {
    var longPressGesture: UILongPressGestureRecognizer!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        self.webView!.allowsBackForwardNavigationGestures = true
        self.webView!.scrollView.bounces = false
        self.webView!.scrollView.keyboardDismissMode = .interactive
        self.webView!.configuration.suppressesIncrementalRendering = true
        
        // Disable 3D Touch
        // Enabling this breaks the magnification loupes again
        self.webView!.allowsLinkPreview = false
        
        // Better defaults
        self.webView!.configuration.allowsInlineMediaPlayback = true
        self.webView!.configuration.mediaTypesRequiringUserActionForPlayback = []
        
        self.webView!.configuration.preferences.javaScriptCanOpenWindowsAutomatically = true

        if #available(iOS 14.0, *) {
            self.webView!.configuration.limitsNavigationsToAppBoundDomains = true
        } else {
            // Fallback on earlier versions
        }
        
        // Dark mode fix
        if #available(iOS 13.0, *) {
            self.webView?.backgroundColor = UIColor.systemBackground
            self.view?.backgroundColor = UIColor.systemBackground
            self.modalPresentationStyle = .overCurrentContext
        } else {
            // Fallback on earlier versions
        }
        self.webView!.configuration.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        self.webView!.configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
    }
}
