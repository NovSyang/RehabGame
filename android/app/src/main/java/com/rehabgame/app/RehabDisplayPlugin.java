package com.rehabgame.app;

import android.app.Activity;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** 训练显示插件只负责隐藏和恢复 Android 系统栏。 */
@CapacitorPlugin(name = "RehabDisplay")
public class RehabDisplayPlugin extends Plugin {
    private volatile boolean immersiveRequested = false;

    @PluginMethod
    public void enterImmersiveMode(PluginCall call) {
        immersiveRequested = true;
        runOnUiThread(call, true);
    }

    @PluginMethod
    public void exitImmersiveMode(PluginCall call) {
        immersiveRequested = false;
        runOnUiThread(call, false);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // 某些 Android 系统回到前台后会重新显示系统栏，需要再次隐藏。
        if (!immersiveRequested || getActivity() == null) return;
        getActivity().runOnUiThread(() -> {
            try {
                applyImmersiveMode(true);
            } catch (RuntimeException ignored) {
                // 厂商系统拒绝窗口控制时保留普通显示，不能让训练因此崩溃。
            }
        });
    }

    private void runOnUiThread(PluginCall call, boolean enabled) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("当前 Android 窗口不可用。");
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                applyImmersiveMode(enabled);
                call.resolve();
            } catch (Exception error) {
                call.reject(enabled ? "无法进入沉浸式训练模式。" : "无法恢复 Android 系统栏。", error);
            }
        });
    }

    private void applyImmersiveMode(boolean enabled) {
        Activity activity = getActivity();
        if (activity == null) return;
        Window window = activity.getWindow();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (enabled) {
            WindowCompat.setDecorFitsSystemWindows(window, false);
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.systemBars());
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars());
            WindowCompat.setDecorFitsSystemWindows(window, true);
        }
    }
}
