package com.stamhoofd.stamhoofd;

import static org.junit.Assert.assertEquals;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class MainActivityTest {

    @Test
    public void enablesWebAuthenticationWhenSupported() {
        Assume.assumeTrue(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION));

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> assertEquals(
                    WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP,
                    WebSettingsCompat.getWebAuthenticationSupport(activity.getBridge().getWebView().getSettings())
            ));
        }
    }
}
