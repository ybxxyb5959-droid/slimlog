package com.slimlog.app;

import android.os.Bundle;
import android.os.Environment;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 전용 플러그인은 super.onCreate 전에 등록해야 한다
        registerPlugin(SecureScreenPlugin.class);
        super.onCreate(savedInstanceState);
        // 지난번에 촬영하고 가져오기 전에 앱이 꺼졌다면 남은 임시 사진을 지운다
        SecureScreenPlugin.clearCaptureDir(getExternalFilesDir(Environment.DIRECTORY_PICTURES));
    }
}
