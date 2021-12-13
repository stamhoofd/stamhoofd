package com.stamhoofd.stamhoofd;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.*;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.util.Log;
import android.webkit.MimeTypeMap;
import androidx.activity.result.ActivityResult;
import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.core.content.FileProvider;
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