package com.stamhoofd.stamhoofd;

import com.getcapacitor.BridgeActivity;

import android.Manifest;
import android.annotation.TargetApi;
import android.app.AlertDialog;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.os.Build;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

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

        MainActivity me = this;

        webView.setWebChromeClient(new WebChromeClient(){
            @TargetApi(Build.VERSION_CODES.LOLLIPOP)
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @TargetApi(Build.VERSION_CODES.M)
                    @Override
                    public void run() {
                        if (ContextCompat.checkSelfPermission(me, Manifest.permission.CAMERA)
                                == PackageManager.PERMISSION_DENIED) {
                            me.pendingPermissionRequest = request;

                            String[] permissions = { Manifest.permission.CAMERA };

                            ActivityCompat.requestPermissions(
                                me,
                                permissions,
                                PERMISSION_REQUEST_CODE);
                            return;
                        }

                        request.grant(request.getResources());
                    }
                });
            }

            // Remove default ugly play icon in video posters
            @Override
            public Bitmap getDefaultVideoPoster() {
                return Bitmap.createBitmap(10, 10, Bitmap.Config.ARGB_8888);
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String permissions[], int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        switch (requestCode) {
            case PERMISSION_REQUEST_CODE:
                if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                } else {
                    pendingPermissionRequest.deny();
                }
                break;
        }
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
