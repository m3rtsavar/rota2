package com.rota.yks;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.activity.ComponentActivity;

public final class MainActivity extends ComponentActivity {
    private static final String APP_URL = "https://rota2.vercel.app/";
    private static final String APP_HOST = "rota2.vercel.app";

    private WebView webView;
    private ValueCallback<Uri[]> pendingFileCallback;
    private final ActivityResultLauncher<String> filePicker =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (pendingFileCallback == null) return;
                pendingFileCallback.onReceiveValue(uri == null ? null : new Uri[]{uri});
                pendingFileCallback = null;
            });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(244, 245, 240));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(244, 245, 240));
        int systemUiVisibility = android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            systemUiVisibility |= android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        getWindow().getDecorView().setSystemUiVisibility(systemUiVisibility);

        webView = new WebView(this);
        webView.setBackgroundColor(android.graphics.Color.rgb(244, 245, 240));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && APP_HOST.equals(uri.getHost())) return false;
                openExternalUrl(uri);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                Uri uri = Uri.parse(url);
                if (!"https".equals(uri.getScheme()) || !APP_HOST.equals(uri.getHost())) {
                    view.stopLoading();
                    view.loadUrl(APP_URL);
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler,
                                           android.net.http.SslError error) {
                handler.cancel();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = callback;
                filePicker.launch("image/*");
                return true;
            }
        });

        setContentView(webView);
        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack();
                else finish();
            }
        });
    }

    private void openExternalUrl(Uri uri) {
        String scheme = uri.getScheme();
        if (!"https".equals(scheme) && !"mailto".equals(scheme)) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "Bu bağlantı açılamadı.", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
