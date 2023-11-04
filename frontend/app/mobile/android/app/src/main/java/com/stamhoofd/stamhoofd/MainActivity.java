package com.stamhoofd.stamhoofd;

import com.getcapacitor.BridgeActivity;
import android.content.res.Configuration;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;

public class MainActivity extends BridgeActivity {

    void setDarkMode() {
        WebView webView = this.bridge.getWebView();
        WebSettings webSettings = webView.getSettings();
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setJavaScriptCanOpenWindowsAutomatically(true);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FileOpenerPlugin.class);
        super.onCreate(savedInstanceState);
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
        this.updateDarkMode();
    }

    @Override
    public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        this.updateDarkMode();
    }

    private void updateDarkMode() {
        // for some reason we need to explicitly do this
        Window window = getWindow();
        window.setNavigationBarColor(ContextCompat.getColor(this, R.color.navigationBarColor));
        window.setStatusBarColor(ContextCompat.getColor(this, R.color.statusBar));

        // Update status bar color
        int nightModeFlags =
                window.getContext().getResources().getConfiguration().uiMode &
                        Configuration.UI_MODE_NIGHT_MASK;
        if (nightModeFlags == Configuration.UI_MODE_NIGHT_YES) {
            window.getDecorView().setSystemUiVisibility(0);
        } else {
            window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        }
    }
}
