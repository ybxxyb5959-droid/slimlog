package com.slimlog.app;

import android.app.Activity;
import android.os.Environment;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * 눈바디 화면 전용 보호.
 * - setSecure: FLAG_SECURE 켜기/끄기 → 최근 앱 화면 미리보기에 내용이 안 보이고 스크린샷·화면 녹화가 막힌다.
 *   눈바디 화면에 들어갈 때 켜고, 나갈 때 끈다 (다른 화면에는 적용하지 않음).
 * - clearCaptureFiles: 사진 촬영 때 Capacitor 가 만든 임시 JPG(getExternalFilesDir(Pictures))를 지운다.
 *   찍은 원본이 암호화되지 않은 채 남지 않게. 앱 시작 때도 한 번 지운다 (MainActivity).
 */
@CapacitorPlugin(name = "SecureScreen")
public class SecureScreenPlugin extends Plugin {

    @PluginMethod
    public void setSecure(PluginCall call) {
        final boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity");
            return;
        }
        activity.runOnUiThread(() -> {
            if (enabled) {
                activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
            JSObject ret = new JSObject();
            ret.put("enabled", enabled);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void clearCaptureFiles(PluginCall call) {
        int deleted = clearCaptureDir(getContext().getExternalFilesDir(Environment.DIRECTORY_PICTURES));
        JSObject ret = new JSObject();
        ret.put("deleted", deleted);
        call.resolve(ret);
    }

    /** 촬영 임시 파일 폴더 비우기 — 앱 전용 폴더라 다른 앱의 사진은 건드리지 않는다 */
    static int clearCaptureDir(File dir) {
        if (dir == null || !dir.isDirectory()) return 0;
        File[] files = dir.listFiles();
        if (files == null) return 0;
        int n = 0;
        for (File f : files) {
            if (f.isFile() && f.delete()) n++;
        }
        return n;
    }
}
