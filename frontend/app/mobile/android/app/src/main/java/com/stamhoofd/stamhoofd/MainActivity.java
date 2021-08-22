package com.stamhoofd.stamhoofd;

import com.getcapacitor.BridgeActivity;

import android.Manifest;
import android.annotation.TargetApi;
import android.app.AlertDialog;
import android.content.res.Configuration;
import android.os.Build;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

public class MainActivity extends BridgeActivity {
    void setDarkMode() {
        // Android "fix" for enabling dark mode
        // @see: https://github.com/ionic-team/capacitor/discussions/1978
        int nightModeFlags = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        WebView webView = this.bridge.getWebView();
        WebSettings webSettings = webView.getSettings();

        if (nightModeFlags == Configuration.UI_MODE_NIGHT_YES) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                // As of Android 10, you can simply force the dark mode
                webSettings.setForceDark(WebSettings.FORCE_DARK_ON);

                // Only let CSS do the work
                if(WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK_STRATEGY)) {
                    WebSettingsCompat.setForceDarkStrategy(webSettings, WebSettingsCompat.DARK_STRATEGY_WEB_THEME_DARKENING_ONLY);
                }
            }
        } else {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                webSettings.setForceDark(WebSettings.FORCE_DARK_OFF);
            }
        }

        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setJavaScriptCanOpenWindowsAutomatically(true);

        String[] permissions =
                {Manifest.permission.READ_EXTERNAL_STORAGE,
                        Manifest.permission.WRITE_EXTERNAL_STORAGE,
                        Manifest.permission.INTERNET,
                        Manifest.permission.RECORD_AUDIO,
                        Manifest.permission.CAMERA};

        // todo: call this only when the webview asks for permissions + fix weird hanging
        ActivityCompat.requestPermissions(
                this,
                permissions,
                1010);

        webView.setWebChromeClient(new WebChromeClient(){
            @TargetApi(Build.VERSION_CODES.LOLLIPOP)
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                Log.d("TAG", "onPermissionRequest");
                runOnUiThread(new Runnable() {
                    @TargetApi(Build.VERSION_CODES.M)
                    @Override
                    public void run() {
                        Log.d("TAG", request.getOrigin().toString());
                        Log.d("TAG", "GRANTED");
                        Log.d("TAG", request.getResources().toString());
                        request.grant(request.getResources());
                    }
                });
            }
        });
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
