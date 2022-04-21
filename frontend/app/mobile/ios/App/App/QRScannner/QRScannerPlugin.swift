//
//  QRScannerPlugin.swift
//  App
//
//  Created by Simon Backx on 15/09/2021.
//

import Foundation
import Capacitor
import AVFoundation
import UIKit

struct QRTarget {
    var value: String
    var since: Date
}

@objc(QRScannerPlugin)
public class QRScannerPlugin: CAPPlugin {
    var captureSession: AVCaptureSession?
    var previewLayer: AVCaptureVideoPreviewLayer?
    
    var detectionView: UIView?
    var listenerView: UIView?
    var lastViewed: Date?
    var target: QRTarget?
    
    private func updatePreviewLayerOrientation() {
        if let connection =  self.previewLayer?.connection  {
            let currentDevice: UIDevice = UIDevice.current
           let orientation: UIDeviceOrientation = currentDevice.orientation
                              
           if connection.isVideoOrientationSupported {
               switch (orientation) {
                   case .portrait: connection.videoOrientation = .portrait
                                       
                   case .landscapeRight: connection.videoOrientation = .landscapeLeft
                                       
                    case .landscapeLeft: connection.videoOrientation = .landscapeRight
                                       
                   case .portraitUpsideDown: connection.videoOrientation =  .portraitUpsideDown
                                       
                   default: connection.videoOrientation =  .portrait
               }
           }
       }
    }
    
    private func setupCaptureSession(call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let webView = self.webView else {
                call.reject("No webView reference yet")
                return
            }
            
            guard let view = webView.superview else {
                call.reject("No superview reference yet")
                return
            }
            
            // Request camera permissions if needed

            let captureSession = AVCaptureSession()
            self.captureSession = captureSession
            
            guard let videoCaptureDevice = AVCaptureDevice.default(AVCaptureDevice.DeviceType.builtInWideAngleCamera, for: .video, position: .back) else {
                call.reject("Could not start a video capture: no device found")
                return
            }
            
            
            let videoInput: AVCaptureDeviceInput

            do {
                videoInput = try AVCaptureDeviceInput(device: videoCaptureDevice)
            } catch {
                call.reject("Faield to start video input for chosen device")
                return
            }
            
            if (captureSession.canAddInput(videoInput)) {
                captureSession.addInput(videoInput)
            } else {
                call.reject("Faield to add video input for chosen device")
                return
            }
            
            let metadataOutput = AVCaptureMetadataOutput()

            if (captureSession.canAddOutput(metadataOutput)) {
                captureSession.addOutput(metadataOutput)

                metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
                metadataOutput.metadataObjectTypes = [.qr]
            } else {
                call.reject("Failed to add metadataOutput to the capturing session")
                return
            }
            
            let listenerView = ListenerView()
            self.listenerView = listenerView
            listenerView.frame = view.bounds
            view.addSubview(listenerView)
            view.sendSubviewToBack(listenerView)
            
            listenerView.translatesAutoresizingMaskIntoConstraints = false

            NSLayoutConstraint.activate([
                listenerView.topAnchor.constraint(equalTo: view.topAnchor),
                listenerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                listenerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                listenerView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
            ])
            
            // Make sure webview is transparent
            webView.isOpaque = false
            webView.backgroundColor = UIColor.clear
            webView.scrollView.backgroundColor = UIColor.clear
            webView.scrollView.isOpaque = false
            
            let previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
            self.previewLayer = previewLayer
            previewLayer.frame = listenerView.layer.bounds
            previewLayer.videoGravity = .resizeAspect
            listenerView.layer.insertSublayer(previewLayer, at: 0)
            self.updatePreviewLayerOrientation()
            
            self.detectionView = UIView()
            self.detectionView!.translatesAutoresizingMaskIntoConstraints = false
            self.detectionView!.layer.borderWidth = 2
            self.detectionView!.layer.borderColor = UIColor.systemRed.cgColor
            self.detectionView!.layer.cornerRadius = 5
            self.detectionView?.isHidden = true
            
            listenerView.addSubview(self.detectionView!)
            
            // Start!
            captureSession.startRunning()
            
            listenerView.onFrameChanged = { [weak self] (bounds: CGRect) -> () in
                self?.updatePreviewLayerOrientation()
                self?.previewLayer?.frame = bounds
            }
            
            // We are done
            call.resolve()
        }
    }
    
    private func stopFlashLight() {
        guard let device = AVCaptureDevice.default(for: AVMediaType.video),
              device.hasTorch else { return }
        
        if !device.isTorchActive {
            return
        }
        
        do {
  
            try device.lockForConfiguration()
            try device.setTorchModeOn(level: 1.0)
            device.torchMode = .off
            device.unlockForConfiguration()
        } catch {
            // failed
        }
    }
    
    @objc func getTorch(_ call: CAPPluginCall) {
        guard let device = AVCaptureDevice.default(for: AVMediaType.video),
              device.hasTorch else { return }
        let status = device.isTorchActive ? true : false
        call.resolve([
            "status": status
        ])
    }
    
    @objc func toggleTorch(_ call: CAPPluginCall) {
        guard let device = AVCaptureDevice.default(for: AVMediaType.video),
              device.hasTorch else { return }
        do {
            let wasActive = device.isTorchActive ? true : false
            try device.lockForConfiguration()
            try device.setTorchModeOn(level: 1.0)
            device.torchMode = device.isTorchActive ? .off : .on
            device.unlockForConfiguration()
            call.resolve([
                "status": !wasActive
            ])
        } catch {
            call.reject("Torch not supported")
        }
    }
    
    @objc func startScanning(_ call: CAPPluginCall) {
        if captureSession != nil {
            // Already capturing
            call.resolve()
            return
        }
        
        switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized: // The user has previously granted access to the camera.
                self.setupCaptureSession(call: call)
                return
            
            case .notDetermined: // The user has not yet been asked for camera access.
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    if granted {
                        self.setupCaptureSession(call: call)
                    } else {
                        call.reject("Permission denied")
                    }
                }
                return
            
            case .denied: // The user has previously denied access.
                call.reject("Permission denied")
                return

            case .restricted: // The user can't grant access due to restrictions.
                call.reject("Permission denied due to user restrictions")
                return
                
        @unknown default:
            call.reject("Permission denied due to an unknown status")
            return
        }
    }
    
    @objc func stopScanning(_ call: CAPPluginCall) {
        self.captureSession?.stopRunning()
        self.captureSession = nil
        
        DispatchQueue.main.async {
            self.listenerView?.removeFromSuperview()
            self.listenerView = nil
            self.previewLayer = nil
            self.detectionView = nil
            
            // Reset background color again
            self.webView?.isOpaque = true
            self.webView?.backgroundColor = UIColor.systemBackground
            
        }
        
        self.stopFlashLight()
        
        // Not yet implemented
        call.resolve()
    }
    
    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        // TODO
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        // TODO
    }
}

extension QRScannerPlugin: AVCaptureMetadataOutputObjectsDelegate {
    private func CGPointDistanceSquared(from: CGPoint, to: CGPoint) -> CGFloat {
        return (from.x - to.x) * (from.x - to.x) + (from.y - to.y) * (from.y - to.y)
    }

    private func calculateDistanceToCenter(metadataObject: AVMetadataObject) -> CGFloat {
        // We don't need to take the square root, because we only care about the magnitude
        return CGPointDistanceSquared(
            from: CGPoint(
                x: metadataObject.bounds.midX,
                y: metadataObject.bounds.midY
            ),
            to: CGPoint(x: 0.5, y: 0.5)
        )
    }
    
    public func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        // Choose the QR-code that is most to the center
        var closed: AVMetadataObject?
        var current: CGFloat?
        
        for m in metadataObjects {
            let distance = calculateDistanceToCenter(metadataObject: m)
            
            guard let currentDistance = current else {
                closed = m
                current = distance
                continue
            }
            
            if distance < currentDistance {
                closed = m
                current = distance
            }
        }
        
        if let metadataObject = closed {
            // We need to use height, since that represents the width in portrait mode
            guard let readableObject = metadataObject as? AVMetadataMachineReadableCodeObject else { return }
            guard let stringValue = readableObject.stringValue else { return }
            
            if let previewLayer = self.previewLayer, let detectionView = self.detectionView {
                if detectionView.isHidden || lastViewed == nil || lastViewed!.timeIntervalSinceNow < -0.2 {
                    detectionView.isHidden = false
                    detectionView.alpha = 1
                    detectionView.frame = previewLayer.layerRectConverted(fromMetadataOutputRect: metadataObject.bounds)
                } else {
                    UIView.animate(withDuration: 0.2) {
                        detectionView.frame = previewLayer.layerRectConverted(fromMetadataOutputRect: metadataObject.bounds)
                        detectionView.alpha = 1
                    }
                }
            }
            
            
            lastViewed = Date(timeIntervalSinceNow: 0)

            if (metadataObject.bounds.height < 0.05) {
                // Clear target if too small
                target = nil
                self.detectionView?.layer.borderColor = UIColor.red.cgColor
                return
            }
            
            if target != nil && target!.value == stringValue {
                // Still same value
            } else {
                target = QRTarget(value: stringValue, since: Date(timeIntervalSinceNow: 0))
            }
            
            self.detectionView?.layer.borderColor = UIColor.init(named: "primary")!.cgColor
            
            // If multiple targets: give some time to adjust
            let timeNeeded = metadataObjects.count <= 1 ? -0.2 : -1
            
            if target!.since.timeIntervalSinceNow < timeNeeded {
                self.notifyListeners("scannedQRCode", data: [ "value": stringValue ])
            }
        } else {
            // Don't clear the target, because in some situations, the qr recognition will stutter and we'll never reach 200ms
            if let detectionView = self.detectionView {
                UIView.animate(withDuration: 0.2) {
                    detectionView.alpha = 0
                }
            }
        }
    }

}
