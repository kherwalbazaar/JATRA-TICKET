package com.jatraexpress.app;

import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void setScreenshotAllowed(boolean allowed) {
                        runOnUiThread(() -> {
                            if (allowed) {
                                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                            } else {
                                getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
                            }
                        });
                    }
                }, "AndroidSecurity");
            }
        } catch (Exception ignored) {
        }
    }
}
