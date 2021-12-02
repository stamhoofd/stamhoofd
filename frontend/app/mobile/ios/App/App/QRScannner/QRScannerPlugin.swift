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

@objc(QRScannerPlugin)
public class QRScannerPlugin: CAPPlugin {
    var captureSession: AVCaptureSession?
    var previewLayer: AVCaptureVideoPreviewLayer?
    
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
            
            // Limit detection size to square
            // Get video dimensions
            let formatDescription = videoCaptureDevice.activeFormat.formatDescription
            let dimensions = CMVideoFormatDescriptionGetDimensions(formatDescription)
            
            // Note: resoloution is in landscape, but all other logic is also in landscape
            let resolution = CGSize(width: CGFloat(dimensions.width), height: CGFloat(dimensions.height))
            let xscale = CGFloat(0.7)
            let yscale = xscale * resolution.height / resolution.width
            
            // Note: we need to swap x and y scale because logic is in landscape
            metadataOutput.rectOfInterest = CGRect(x: 0.5 - yscale/2, y: 0.5 - xscale/2, width: yscale, height: xscale)
            
            // Make sure webview is transparent
            webView.isOpaque = false
            webView.backgroundColor = UIColor.clear
            
            let previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
            self.previewLayer = previewLayer
            previewLayer.frame = view.layer.bounds
            previewLayer.videoGravity = .resizeAspect
            view.layer.insertSublayer(previewLayer, at: 0)
            
            // Start!
            captureSession.startRunning()
                        

            // Create the camera view

            // Start the scanning and setup a delegate

            // Error if needed
            // using call.reject("Must provide an id")


            // We are done
            call.resolve()
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
            // Reset background color again
            self.webView?.isOpaque = true
            self.webView?.backgroundColor = UIColor.systemBackground
            
            self.previewLayer?.removeFromSuperlayer()
            self.previewLayer = nil
        }
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
    public func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        // captureSession?.stopRunning()
        
        if let metadataObject = metadataObjects.first {
            guard let readableObject = metadataObject as? AVMetadataMachineReadableCodeObject else { return }
            guard let stringValue = readableObject.stringValue else { return }
            self.notifyListeners("scannedQRCode", data: [ "value": stringValue ])
        }
    }

}
