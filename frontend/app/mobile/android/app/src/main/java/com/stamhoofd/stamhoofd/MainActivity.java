package com.stamhoofd.stamhoofd;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;

import android.Manifest;
import android.annotation.TargetApi;
import android.app.AlertDialog;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.RequiresApi;
import androidx.compose.ui.graphics.Color;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 12445919;

    protected PermissionRequest pendingPermissionRequest;

    void setDarkMode() {
        // Android "fix" for enabling dark mode
        // @see: https://github.com/ionic-team/capacitor/discussions/1978
        int nightModeFlags = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        WebView webView = this.bridge.getWebView();
        WebSettings webSettings = webView.getSettings();

        // Fix background color in dark mode: always use a color that switches depending on the theme
        webView.setBackgroundColor(this.getResources().getColor(R.color.navigationBarColor));

        if (nightModeFlags == Configuration.UI_MODE_NIGHT_YES) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // As of Android 10, you can simply force the dark mode
                webSettings.setForceDark(WebSettings.FORCE_DARK_ON);

                // Only let CSS do the work
                if(WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK_STRATEGY)) {
                    WebSettingsCompat.setForceDarkStrategy(webSettings, WebSettingsCompat.DARK_STRATEGY_WEB_THEME_DARKENING_ONLY);
                }
            }
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                webSettings.setForceDark(WebSettings.FORCE_DARK_OFF);
            }
        }

        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setJavaScriptCanOpenWindowsAutomatically(true);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(FileOpenerPlugin.class);
    }

    @Override
    public void onStart() {
        super.onStart();
        setDarkMode();
    }

    @Override
    public void onResume() {
        super.onResume();
        setDarkMode();
    }
}
