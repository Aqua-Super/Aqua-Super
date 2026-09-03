package com.aquasuper.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;
    private static final String APP_URL = "https://aqua-super.github.io/Aqua-Super/Aqua_Super.html";

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true); s.setAllowContentAccess(true); s.setBuiltInZoomControls(false); s.setDisplayZoomControls(false);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u=r.getUrl(); String scheme=u.getScheme();
                if (scheme != null && !scheme.equals("http") && !scheme.equals("https")) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW,u)); } catch(Exception ignored) {}
                    return true;
                }
                return false;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, String url) {
                if (url.startsWith("http://") || url.startsWith("https://")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch(Exception ignored) {}
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view,url);
                view.evaluateJavascript("(function(){try{if(window.__aquaAmountResetInstalled)return;window.__aquaAmountResetInstalled=true;function clearPay(){var p=document.getElementById('pay');if(p)p.value='';}if(typeof window.saveEntry==='function'){var f=window.saveEntry;window.saveEntry=function(){var r=f.apply(this,arguments);setTimeout(clearPay,150);return r;};}if(typeof window.saveEntrySMS==='function'){var g=window.saveEntrySMS;window.saveEntrySMS=function(){var r=g.apply(this,arguments);setTimeout(clearPay,150);return r;};}}catch(e){}})();", null);
            }
        });
        webView.loadUrl(APP_URL);
    }
    @Override public void onBackPressed() { if(webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
}
