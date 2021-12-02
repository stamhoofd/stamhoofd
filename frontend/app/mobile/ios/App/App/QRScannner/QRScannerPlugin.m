//
//  QRScannerPlugin.m
//  App
//
//  Created by Simon Backx on 15/09/2021.
//

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(QRScannerPlugin, "QRScanner",
    CAP_PLUGIN_METHOD(startScanning, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopScanning, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getTorch, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(toggleTorch, CAPPluginReturnPromise);
)
