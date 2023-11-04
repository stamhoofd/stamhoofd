package com.stamhoofd.stamhoofd;

import android.Manifest;
import android.annotation.TargetApi;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.util.Log;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebView;

import androidx.activity.result.ActivityResult;
import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;

@CapacitorPlugin(name = "FileOpener")
public class FileOpenerPlugin extends Plugin {
    private boolean isPresenting = false;
    private Uri saveFrom;

    @Override
    public void load() {
        // This is the moment where we can replace the chrome and webview
        // Because trusted root CA don't work in WebViews in Android...
        // Android review rejects because of this code, even in release mode :/ (it doesn't see the debug check)
        /*if (BuildConfig.BUILD_TYPE.equals("debug")) {
            // We need to make sure we keep using the bridges custom logic
            BridgeWebViewClient client = new BridgeWebViewClient(this.bridge) {
                @Override
                public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                    //Do something
                    handler.proceed();
                }
            };
            this.bridge.setWebViewClient(client);
        }*/

        BridgeWebChromeClient chromeClient = new BridgeWebChromeClient(this.bridge) {
            // Remove default ugly play icon in video posters
            @Override
            public Bitmap getDefaultVideoPoster() {
                return Bitmap.createBitmap(10, 10, Bitmap.Config.ARGB_8888);
            }
        };
        //this.bridge.setWebChromeClient(chromeClient);
    }

    private String getMimeType(String url) {
        String type = null;
        String extension = MimeTypeMap.getFileExtensionFromUrl(url);
        if (extension != null) {
            type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
        }
        return type;
    }

    private boolean isFileUrl(String url) {
        return url.startsWith("file:");
    }

    @ActivityCallback
    private void activityResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_OK) {
            Intent data = result.getData();
            Uri saveTo = data.getData();

            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                call.reject("Android version too old. Please update your device.");
                isPresenting = false;
                return;
            }
            try {
                this.writeInFile(saveTo, this.saveFrom);
                call.resolve();
            } catch (IOException exception) {
                call.reject("Writing to file failed");
            }
            
        } else {
            call.reject("Saving canceled");
        }
        isPresenting = false;
    }

    @RequiresApi(api = Build.VERSION_CODES.O)
    private void writeInFile(@NonNull Uri saveTo, @NonNull Uri from) throws IOException {
        OutputStream outputStream = this.getActivity().getContentResolver().openOutputStream(saveTo);
        Files.copy(new File(from.getPath()).toPath(), outputStream);
    }

    @PluginMethod
    public void open(PluginCall call) {
        if (isPresenting) {
            call.reject("Already presented an activity");
            return;
        }

        String url = call.getString("url");
        if (url == null) {
            call.reject("Must provide a url to open");
            return;
        }

        if (!isFileUrl(url)) {
            call.reject("Must provide a file to open");
            return;
        }

        String type = getMimeType(url);
        if (type == null) {
            type = "*/*";
        }

        Uri fileUrl = FileProvider.getUriForFile(
                getActivity(),
                getContext().getPackageName() + ".fileprovider",
                new File(Uri.parse(url).getPath())
        );

        this.saveFrom = Uri.parse(url);

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
                Intent.FLAG_GRANT_READ_URI_PERMISSION |
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        intent.putExtra(Intent.EXTRA_TITLE, url.substring(url.lastIndexOf("/")+1));
        intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, Environment.DIRECTORY_DOCUMENTS);
        intent.setType(type);

        try {
            isPresenting = true;
            startActivityForResult(call, intent, "activityResult");
        } catch (Exception ex) {
            call.reject("Failed to open");
        }
    }
}