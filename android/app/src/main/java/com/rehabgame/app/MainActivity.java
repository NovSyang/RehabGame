package com.rehabgame.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 本地插件必须在 Bridge 初始化前注册，TypeScript 才能调用原生更新 API。
        registerPlugin(AndroidApkUpdaterPlugin.class);
        // 训练显示插件负责沉浸式系统栏，不把窗口业务堆进 Activity。
        registerPlugin(RehabDisplayPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
