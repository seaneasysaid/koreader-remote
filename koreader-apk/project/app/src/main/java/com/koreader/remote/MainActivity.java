package com.koreader.remote;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.AsyncTask;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
    private WebView webView;
    // volume keys: true = page turn, false = system volume
    private boolean volumePageMode = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowFileAccessFromFileURLs(true);
        ws.setAllowUniversalAccessFromFileURLs(true);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);
        ws.setUseWideViewPort(true);
        ws.setLoadWithOverviewMode(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        // JS bridge: page calls window.KR.saveScreenshot(baseUrl)
        webView.addJavascriptInterface(new Bridge(), "KR");
        webView.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    // ---- JS bridge for screenshot download to phone storage ----
    private class Bridge {
        @JavascriptInterface
        public void saveScreenshot(final String baseUrl) {
            new ScreenshotTask().execute(baseUrl);
        }

        // Web page toggles whether volume keys turn pages or change system volume.
        @JavascriptInterface
        public void setVolumePageMode(boolean pageMode) {
            volumePageMode = pageMode;
        }
    }

    private class ScreenshotTask extends AsyncTask<String, Void, String> {
        @Override
        protected String doInBackground(String... args) {
            String base = args[0];
            String url = base + "/koreader/device/screen/bb";
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(15000);
                conn.setInstanceFollowRedirects(true);
                int code = conn.getResponseCode();
                if (code != 200) { conn.disconnect(); return "HTTP " + code; }
                InputStream in = new BufferedInputStream(conn.getInputStream());
                byte[] data = readAll(in);
                in.close();
                conn.disconnect();
                String name = "koreader_" + System.currentTimeMillis() + ".png";
                return saveToDownloads(data, name);
            } catch (Exception e) {
                return e.getMessage();
            }
        }

        @Override
        protected void onPostExecute(String err) {
            if (err == null) {
                Toast.makeText(MainActivity.this, "截图已保存到下载目录 ✓", Toast.LENGTH_LONG).show();
                webView.evaluateJavascript("if(window.__krShot)window.__krShot(true)", null);
            } else {
                Toast.makeText(MainActivity.this, "截图失败: " + err, Toast.LENGTH_LONG).show();
                webView.evaluateJavascript("if(window.__krShot)window.__krShot(false)", null);
            }
        }
    }

    private static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        return bo.toByteArray();
    }

    private String saveToDownloads(byte[] data, String name) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, "image/png");
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri item = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (item == null) return "insert failed";
                try (OutputStream os = getContentResolver().openOutputStream(item)) { os.write(data); }
            } else {
                int perm = checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE);
                File dir;
                if (perm == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                } else {
                    dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                }
                File f = new File(dir, name);
                try (OutputStream os = new FileOutputStream(f)) { os.write(data); }
            }
            return null;
        } catch (Exception e) {
            return e.getMessage();
        }
    }

    // ---- Volume keys: UP = prev page, DOWN = next page (only when page mode is on) ----
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int k = event.getKeyCode();
        if (k == KeyEvent.KEYCODE_VOLUME_UP || k == KeyEvent.KEYCODE_VOLUME_DOWN) {
            if (!volumePageMode) {
                // let the system handle volume normally
                return super.dispatchKeyEvent(event);
            }
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                final String act = (k == KeyEvent.KEYCODE_VOLUME_UP) ? "prev" : "next";
                webView.post(() -> webView.evaluateJavascript("window.runAction('" + act + "')", null));
            }
            return true; // consume so system volume UI / beep is suppressed
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
    }
}
