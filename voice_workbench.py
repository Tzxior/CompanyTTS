
# -*- coding: utf-8 -*-
"""
Qwen3-TTS 本地角色语音工作台
CPU 推理，默认使用 XVector 角色音色克隆。

目录结构：
D:\\CompanyTTS\\
    voice_workbench.py
    references\\
        角色A\\
            日常.wav
            认真.wav
        角色B\\
            参考音频.ogg
    outputs\\
    Qwen3TTS\\
        models\\
            Qwen3-TTS-12Hz-1.7B-Base\\

功能：
1. 自动扫描角色文件夹
2. 每个角色独立选择参考音频
3. 显示参考音频信息
4. 默认 XVector 模式
5. 保留 ICL 模式及参考文字稿管理
6. CPU 后台加载模型、后台生成
7. 输出 WAV 音频
"""

import os
import re
import sys
import threading
import traceback
import subprocess
import time
from datetime import datetime
from pathlib import Path

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from tkinter.scrolledtext import ScrolledText


# ============================================================
# 路径设置
# ============================================================

ROOT = Path(__file__).resolve().parent

QWEN_ROOT = ROOT / "Qwen3TTS"

MODEL_DIR_DEFAULT = (
    QWEN_ROOT
    / "models"
    / "Qwen3-TTS-12Hz-1.7B-Base"
)

REFERENCE_DIR_DEFAULT = ROOT / "references"
OUTPUT_DIR_DEFAULT = ROOT / "outputs"

SUPPORTED_AUDIO = {
    ".wav",
    ".mp3",
    ".flac",
    ".ogg",
    ".m4a",
    ".aac",
}

LANGUAGES = [
    "Chinese",
    "Japanese",
    "English",
    "Korean",
    "French",
    "German",
    "Spanish",
    "Portuguese",
    "Russian",
    "Italian",
]


# ============================================================
# 主窗口
# ============================================================

class VoiceWorkbench:

    def __init__(self, root):

        self.root = root

        self.root.title(
            "Qwen3-TTS 角色语音工作台"
        )

        self.root.geometry("1000x850")
        self.root.minsize(850, 700)

        # 模型对象
        self.model = None

        # 是否正在执行任务
        self.busy = False

        # 当前角色参考音频
        self.reference_files = []

        # 下拉框显示文字 -> 文件路径
        self.reference_display_to_path = {}

        # 每个角色上次选择的参考音频
        self.role_last_selection = {}

        # ----------------------------------------------------
        # 路径变量
        # ----------------------------------------------------

        self.model_dir_var = tk.StringVar(
            value=str(MODEL_DIR_DEFAULT)
        )

        self.reference_dir_var = tk.StringVar(
            value=str(REFERENCE_DIR_DEFAULT)
        )

        self.output_dir_var = tk.StringVar(
            value=str(OUTPUT_DIR_DEFAULT)
        )

        # ----------------------------------------------------
        # 角色及参考音频变量
        # ----------------------------------------------------

        self.role_var = tk.StringVar()
        self.reference_var = tk.StringVar()

        self.reference_info_var = tk.StringVar(
            value="尚未选择参考音频。"
        )

        # ----------------------------------------------------
        # 生成参数
        # ----------------------------------------------------

        self.language_var = tk.StringVar(
            value="Chinese"
        )

        self.mode_var = tk.StringVar(
            value="XVector"
        )

        self.output_name_var = tk.StringVar()

        self.status_var = tk.StringVar(value="就绪。请先加载模型。")
        self.temperature_var = tk.StringVar(value="0.9")
        self.top_k_var = tk.StringVar(value="50")
        self.top_p_var = tk.StringVar(value="1.0")
        self.repetition_penalty_var = tk.StringVar(value="1.05")
        self.max_new_tokens_var = tk.StringVar(value="2048")
        self.do_sample_var = tk.BooleanVar(value=True)
        self.elapsed_var = tk.StringVar(value="00:00")
        self.progress_note_var = tk.StringVar(value="等待生成任务")
        self.stats_chars_var = tk.StringVar(value="—")
        self.stats_tokens_var = tk.StringVar(value="—")
        self.stats_token_speed_var = tk.StringVar(value="—")
        self.stats_audio_var = tk.StringVar(value="—")
        self.stats_elapsed_var = tk.StringVar(value="—")
        self.stats_rtf_var = tk.StringVar(value="—")
        self.task_started_at = None

        # 创建界面
        self._build_ui()

        # 创建必要目录
        self._ensure_directories()

        # 扫描角色
        self.refresh_roles()

        # 关闭事件
        self.root.protocol(
            "WM_DELETE_WINDOW",
            self._on_close
        )

    # ========================================================
    # 界面
    # ========================================================

    def _build_ui(self):

        outer = ttk.Frame(
            self.root,
            padding=10
        )

        outer.pack(
            fill="both",
            expand=True
        )

        # ----------------------------------------------------
        # 路径设置
        # ----------------------------------------------------

        paths = ttk.LabelFrame(
            outer,
            text="路径设置",
            padding=8
        )

        paths.pack(
            fill="x",
            pady=(0, 8)
        )

        self._path_row(
            paths,
            0,
            "模型目录：",
            self.model_dir_var,
            self._browse_model
        )

        self._path_row(
            paths,
            1,
            "角色素材：",
            self.reference_dir_var,
            self._browse_reference
        )

        self._path_row(
            paths,
            2,
            "输出目录：",
            self.output_dir_var,
            self._browse_output
        )

        # ----------------------------------------------------
        # 角色与参考音频
        # ----------------------------------------------------

        ref_frame = ttk.LabelFrame(
            outer,
            text="角色与参考音频",
            padding=8
        )

        ref_frame.pack(
            fill="x",
            pady=(0, 8)
        )

        ttk.Label(
            ref_frame,
            text="角色："
        ).grid(
            row=0,
            column=0,
            sticky="w",
            padx=(0, 5),
            pady=4
        )

        self.role_combo = ttk.Combobox(
            ref_frame,
            textvariable=self.role_var,
            state="readonly",
            width=28
        )

        self.role_combo.grid(
            row=0,
            column=1,
            sticky="ew",
            padx=(0, 8),
            pady=4
        )

        self.role_combo.bind(
            "<<ComboboxSelected>>",
            self._on_role_selected
        )

        ttk.Button(
            ref_frame,
            text="刷新角色",
            command=self.refresh_roles
        ).grid(
            row=0,
            column=2,
            padx=4,
            pady=4
        )

        ttk.Button(
            ref_frame,
            text="打开角色文件夹",
            command=self._open_role_folder
        ).grid(
            row=0,
            column=3,
            padx=4,
            pady=4
        )

        # 参考音频选择框

        ttk.Label(
            ref_frame,
            text="参考音频："
        ).grid(
            row=1,
            column=0,
            sticky="w",
            padx=(0, 5),
            pady=4
        )

        self.reference_combo = ttk.Combobox(
            ref_frame,
            textvariable=self.reference_var,
            state="readonly",
            width=55
        )

        self.reference_combo.grid(
            row=1,
            column=1,
            columnspan=2,
            sticky="ew",
            padx=(0, 8),
            pady=4
        )

        self.reference_combo.bind(
            "<<ComboboxSelected>>",
            self._on_reference_selected
        )

        ttk.Button(
            ref_frame,
            text="打开音频所在位置",
            command=self._open_reference_location
        ).grid(
            row=1,
            column=3,
            padx=4,
            pady=4
        )

        ttk.Label(
            ref_frame,
            textvariable=self.reference_info_var,
            foreground="#555555"
        ).grid(
            row=2,
            column=0,
            columnspan=4,
            sticky="w",
            pady=(3, 2)
        )

        ref_frame.columnconfigure(
            1,
            weight=1
        )

        # ----------------------------------------------------
        # 参考文字稿
        # ----------------------------------------------------

        transcript_frame = ttk.LabelFrame(
            outer,
            text="参考音频文字稿（仅 ICL 模式需要）",
            padding=8
        )

        transcript_frame.pack(
            fill="x",
            pady=(0, 8)
        )

        self.ref_text = ScrolledText(
            transcript_frame,
            height=3,
            wrap="word"
        )

        self.ref_text.pack(
            fill="x",
            expand=False
        )

        transcript_buttons = ttk.Frame(
            transcript_frame
        )

        transcript_buttons.pack(
            fill="x",
            pady=(5, 0)
        )

        ttk.Button(
            transcript_buttons,
            text="读取该音频的文字稿",
            command=self._load_transcript
        ).pack(
            side="left"
        )

        ttk.Button(
            transcript_buttons,
            text="保存文字稿",
            command=self._save_transcript
        ).pack(
            side="left",
            padx=6
        )

        ttk.Label(
            transcript_buttons,
            text="文字稿保存在对应音频旁边的同名 TXT 文件中；XVector 不需要文字稿。",
            foreground="#666666"
        ).pack(
            side="left",
            padx=8
        )

        # ----------------------------------------------------
        # 生成区域
        # ----------------------------------------------------

        gen_frame = ttk.LabelFrame(
            outer,
            text="语音生成",
            padding=8
        )

        gen_frame.pack(
            fill="both",
            expand=True,
            pady=(0, 8)
        )

        options = ttk.Frame(gen_frame)

        options.pack(
            fill="x",
            pady=(0, 6)
        )

        ttk.Label(
            options,
            text="生成语言："
        ).pack(
            side="left"
        )

        self.language_combo = ttk.Combobox(
            options,
            textvariable=self.language_var,
            values=LANGUAGES,
            state="readonly",
            width=16
        )

        self.language_combo.pack(
            side="left",
            padx=(4, 18)
        )

        ttk.Label(
            options,
            text="克隆模式："
        ).pack(
            side="left"
        )

        ttk.Radiobutton(
            options,
            text="XVector（推荐）",
            variable=self.mode_var,
            value="XVector"
        ).pack(
            side="left",
            padx=4
        )

        ttk.Radiobutton(
            options,
            text="ICL（需要准确文字稿）",
            variable=self.mode_var,
            value="ICL"
        ).pack(
            side="left",
            padx=4
        )

        ttk.Label(
            gen_frame,
            text="待合成台词："
        ).pack(
            anchor="w"
        )

        self.target_text = ScrolledText(
            gen_frame,
            height=9,
            wrap="word"
        )

        self.target_text.pack(
            fill="both",
            expand=True,
            pady=(3, 8)
        )

        # 输出文件名

        name_row = ttk.Frame(gen_frame)

        name_row.pack(
            fill="x",
            pady=(0, 7)
        )

        ttk.Label(
            name_row,
            text="输出文件名（不含扩展名，可留空）："
        ).pack(
            side="left"
        )

        ttk.Entry(
            name_row,
            textvariable=self.output_name_var
        ).pack(
            side="left",
            fill="x",
            expand=True,
            padx=5
        )

        advanced = ttk.LabelFrame(gen_frame, text="高级生成参数（仅影响后续生成）", padding=6)
        advanced.pack(fill="x", pady=(0, 7))
        for label, variable, width in [
            ("Temperature", self.temperature_var, 7),
            ("Top K", self.top_k_var, 6),
            ("Top P", self.top_p_var, 6),
            ("Repetition Penalty", self.repetition_penalty_var, 7),
            ("Max New Tokens", self.max_new_tokens_var, 8),
        ]:
            cell = ttk.Frame(advanced)
            cell.pack(side="left", padx=(0, 9))
            ttk.Label(cell, text=label).pack(anchor="w")
            ttk.Entry(cell, textvariable=variable, width=width).pack(anchor="w")
        ttk.Checkbutton(advanced, text="启用采样", variable=self.do_sample_var).pack(
            side="left", padx=4, pady=(14, 0)
        )

        # 按钮

        buttons = ttk.Frame(gen_frame)

        buttons.pack(
            fill="x"
        )

        self.load_button = ttk.Button(
            buttons,
            text="加载模型",
            command=self.load_model
        )

        self.load_button.pack(
            side="left"
        )

        self.generate_button = ttk.Button(
            buttons,
            text="开始生成",
            command=self.generate,
            state="disabled"
        )

        self.generate_button.pack(
            side="left",
            padx=8
        )

        ttk.Button(
            buttons,
            text="打开输出目录",
            command=self._open_output_folder
        ).pack(
            side="left"
        )

        ttk.Button(
            buttons, text="清空台词", command=self._clear_target
        ).pack(side="left", padx=8)

        monitor = ttk.LabelFrame(gen_frame, text="生成进度与统计", padding=7)
        monitor.pack(fill="x", pady=(8, 0))
        progress_row = ttk.Frame(monitor)
        progress_row.pack(fill="x")
        self.progressbar = ttk.Progressbar(progress_row, mode="indeterminate")
        self.progressbar.pack(side="left", fill="x", expand=True, padx=(0, 8))
        ttk.Label(progress_row, textvariable=self.elapsed_var, width=10).pack(side="right")
        ttk.Label(monitor, textvariable=self.progress_note_var, foreground="#666666").pack(
            anchor="w", pady=(3, 5)
        )
        stats = ttk.Frame(monitor)
        stats.pack(fill="x")
        for index, (label, variable) in enumerate([
            ("输入字符", self.stats_chars_var),
            ("Codec Token ID", self.stats_tokens_var),
            ("Token ID/s", self.stats_token_speed_var),
            ("音频时长", self.stats_audio_var),
            ("总耗时", self.stats_elapsed_var),
            ("RTF", self.stats_rtf_var),
        ]):
            cell = ttk.Frame(stats)
            cell.grid(row=0, column=index, sticky="w", padx=(0, 12))
            ttk.Label(cell, text=label, foreground="#666666").pack(anchor="w")
            ttk.Label(cell, textvariable=variable, font=("Segoe UI", 10, "bold")).pack(anchor="w")

        # ----------------------------------------------------
        # 状态栏
        # ----------------------------------------------------

        status_frame = ttk.Frame(outer)

        status_frame.pack(
            fill="x",
            pady=(0, 5)
        )

        ttk.Label(
            status_frame,
            text="状态："
        ).pack(
            side="left"
        )

        ttk.Label(
            status_frame,
            textvariable=self.status_var
        ).pack(
            side="left",
            fill="x",
            expand=True
        )

        # ----------------------------------------------------
        # 日志
        # ----------------------------------------------------

        log_frame = ttk.LabelFrame(
            outer,
            text="运行日志",
            padding=6
        )

        log_frame.pack(
            fill="both",
            expand=True
        )

        self.log_text = ScrolledText(
            log_frame,
            height=9,
            wrap="word",
            state="disabled"
        )

        self.log_text.pack(
            fill="both",
            expand=True
        )

        self._log("工作台启动。默认采用 XVector 模式。")
        self._log(f"工作目录：{ROOT}")

    def _path_row(
        self,
        parent,
        row,
        label,
        variable,
        browse_command
    ):

        ttk.Label(
            parent,
            text=label
        ).grid(
            row=row,
            column=0,
            sticky="w",
            padx=(0, 5),
            pady=3
        )

        ttk.Entry(
            parent,
            textvariable=variable
        ).grid(
            row=row,
            column=1,
            sticky="ew",
            padx=4,
            pady=3
        )

        ttk.Button(
            parent,
            text="浏览…",
            command=browse_command
        ).grid(
            row=row,
            column=2,
            padx=4,
            pady=3
        )

        parent.columnconfigure(
            1,
            weight=1
        )

    # ========================================================
    # 基础辅助函数
    # ========================================================

    def _ensure_directories(self):

        Path(
            self.reference_dir_var.get()
        ).mkdir(
            parents=True,
            exist_ok=True
        )

        Path(
            self.output_dir_var.get()
        ).mkdir(
            parents=True,
            exist_ok=True
        )

        QWEN_ROOT.mkdir(
            parents=True,
            exist_ok=True
        )

    def _log(self, message):

        timestamp = datetime.now().strftime(
            "%H:%M:%S"
        )

        line = f"[{timestamp}] {message}\n"

        def append():

            self.log_text.configure(
                state="normal"
            )

            self.log_text.insert(
                "end",
                line
            )

            self.log_text.see(
                "end"
            )

            self.log_text.configure(
                state="disabled"
            )

        if threading.current_thread() is threading.main_thread():
            append()
        else:
            self.root.after(
                0,
                append
            )

    def _set_status(self, message):

        self.root.after(
            0,
            lambda: self.status_var.set(message)
        )

    def _set_busy(self, busy, status=None):

        def update():

            self.busy = busy
            if busy:
                self.task_started_at = time.monotonic()
                self.progressbar.start(12)
                self.progress_note_var.set("任务运行中；模型未提供真实百分比进度。")
                self._tick_elapsed()
            else:
                self.progressbar.stop()

            if busy:

                self.load_button.configure(
                    state="disabled"
                )

                self.generate_button.configure(
                    state="disabled"
                )

            else:

                self.load_button.configure(
                    state="normal"
                )

                self.generate_button.configure(
                    state="normal" if self.model is not None else "disabled"
                )

            if status:
                self.status_var.set(status)

        self.root.after(
            0,
            update
        )

    def _safe_name(self, value):

        value = re.sub(
            r'[\\/:*?"<>|]+',
            "_",
            value.strip()
        )

        value = re.sub(
            r"\s+",
            "_",
            value
        )

        return value[:80] or "voice"

    # ========================================================
    # 路径选择
    # ========================================================

    def _browse_model(self):

        path = filedialog.askdirectory(
            title="选择 Qwen3-TTS 模型目录",
            initialdir=(
                self.model_dir_var.get()
                if Path(self.model_dir_var.get()).exists()
                else str(ROOT)
            )
        )

        if path:
            self.model_dir_var.set(path)

    def _browse_reference(self):

        path = filedialog.askdirectory(
            title="选择角色参考音频总目录",
            initialdir=(
                self.reference_dir_var.get()
                if Path(self.reference_dir_var.get()).exists()
                else str(ROOT)
            )
        )

        if path:
            self.reference_dir_var.set(path)
            self.refresh_roles()

    def _browse_output(self):

        path = filedialog.askdirectory(
            title="选择语音输出目录",
            initialdir=(
                self.output_dir_var.get()
                if Path(self.output_dir_var.get()).exists()
                else str(ROOT)
            )
        )

        if path:
            self.output_dir_var.set(path)

    # ========================================================
    # 角色与参考音频管理
    # ========================================================

    def refresh_roles(self):

        base = Path(
            self.reference_dir_var.get()
        )

        base.mkdir(
            parents=True,
            exist_ok=True
        )

        roles = sorted(
            p.name
            for p in base.iterdir()
            if p.is_dir() and not p.name.startswith(".")
        )

        self.role_combo["values"] = roles

        current = self.role_var.get()

        if current in roles:

            self._populate_reference_files(
                current
            )

        elif roles:

            self.role_var.set(
                roles[0]
            )

            self._populate_reference_files(
                roles[0]
            )

        else:

            self.role_var.set("")
            self.reference_var.set("")

            self.reference_combo["values"] = []

            self.reference_files = []

            self.reference_info_var.set(
                "没有找到角色文件夹。请在 references 下按角色建立子文件夹。"
            )

        self._log(
            f"扫描角色完成：找到 {len(roles)} 个角色。"
        )

    def _on_role_selected(self, event=None):

        role = self.role_var.get()

        if role:
            self._populate_reference_files(role)

    def _populate_reference_files(self, role):

        role_dir = (
            Path(self.reference_dir_var.get())
            / role
        )

        if not role_dir.is_dir():

            self.reference_files = []

            self.reference_combo["values"] = []

            self.reference_var.set("")

            self.reference_info_var.set(
                "角色目录不存在。"
            )

            return

        files = sorted(
            (
                p
                for p in role_dir.rglob("*")
                if p.is_file()
                and p.suffix.lower() in SUPPORTED_AUDIO
            ),
            key=lambda p: str(p).lower()
        )

        self.reference_files = files

        self.reference_display_to_path = {}

        displays = []

        for path in files:

            try:

                display = str(
                    path.relative_to(role_dir)
                )

            except ValueError:

                display = path.name

            self.reference_display_to_path[
                display
            ] = path

            displays.append(display)

        self.reference_combo["values"] = displays

        remembered = self.role_last_selection.get(
            role
        )

        if remembered and remembered in self.reference_display_to_path:

            self.reference_var.set(
                remembered
            )

        elif displays:

            self.reference_var.set(
                displays[0]
            )

        else:

            self.reference_var.set("")

            self.reference_info_var.set(
                f"角色“{role}”目录中没有支持的音频文件。"
            )

            return

        self._update_reference_info()

        self._load_transcript(
            silent=True
        )

        self._log(
            f"角色“{role}”：找到 {len(files)} 段参考音频。"
        )

    def _selected_reference_path(self):

        display = self.reference_var.get()

        return self.reference_display_to_path.get(
            display
        )

    def _on_reference_selected(self, event=None):

        role = self.role_var.get()

        display = self.reference_var.get()

        if role and display:

            self.role_last_selection[role] = display

        self._update_reference_info()

        self._load_transcript(
            silent=True
        )

    def _update_reference_info(self):

        path = self._selected_reference_path()

        if path is None:

            self.reference_info_var.set(
                "尚未选择参考音频。"
            )

            return

        try:

            import soundfile as sf

            info = sf.info(
                str(path)
            )

            duration = info.duration

            details = (
                f"{path.name}  |  "
                f"{duration:.1f} 秒  |  "
                f"{info.samplerate} Hz  |  "
                f"{info.channels} 声道  |  "
                f"{path.stat().st_size / 1024:.1f} KB"
            )

        except Exception as exc:

            details = (
                f"{path.name}  |  无法读取音频信息：{exc}"
            )

        self.reference_info_var.set(
            details
        )

    # ========================================================
    # 打开文件夹
    # ========================================================

    def _open_role_folder(self):

        role = self.role_var.get()

        if not role:

            messagebox.showinfo(
                "提示",
                "请先选择角色。"
            )

            return

        path = (
            Path(self.reference_dir_var.get())
            / role
        )

        path.mkdir(
            parents=True,
            exist_ok=True
        )

        self._open_path(path)

    def _open_reference_location(self):

        path = self._selected_reference_path()

        if path is None:

            messagebox.showinfo(
                "提示",
                "请先选择参考音频。"
            )

            return

        self._open_path(
            path.parent
        )

    def _open_output_folder(self):

        path = Path(
            self.output_dir_var.get()
        )

        path.mkdir(
            parents=True,
            exist_ok=True
        )

        self._open_path(path)

    @staticmethod
    def _open_path(path):

        try:

            if sys.platform.startswith("win"):

                os.startfile(str(path))

            elif sys.platform == "darwin":

                subprocess.Popen(
                    ["open", str(path)]
                )

            else:

                subprocess.Popen(
                    ["xdg-open", str(path)]
                )

        except Exception as exc:

            messagebox.showerror(
                "打开失败",
                str(exc)
            )

    # ========================================================
    # 参考文字稿管理
    # ========================================================

    def _transcript_path(self, audio_path):

        return audio_path.with_suffix(".txt")

    def _load_transcript(self, silent=False):

        path = self._selected_reference_path()

        if path is None:

            if not silent:

                messagebox.showinfo(
                    "提示",
                    "请先选择参考音频。"
                )

            return

        transcript_path = self._transcript_path(
            path
        )

        self.ref_text.delete(
            "1.0",
            "end"
        )

        if transcript_path.is_file():

            try:

                content = transcript_path.read_text(
                    encoding="utf-8-sig"
                )

                self.ref_text.insert(
                    "1.0",
                    content
                )

                if not silent:

                    self._log(
                        f"已读取参考文字稿：{transcript_path}"
                    )

            except Exception as exc:

                if not silent:

                    messagebox.showerror(
                        "读取失败",
                        str(exc)
                    )

        elif not silent:

            messagebox.showinfo(
                "没有文字稿",
                f"没有找到：\n{transcript_path}\n\n"
                "XVector 模式不需要文字稿。"
            )

    def _save_transcript(self):

        path = self._selected_reference_path()

        if path is None:

            messagebox.showinfo(
                "提示",
                "请先选择参考音频。"
            )

            return

        text = self.ref_text.get(
            "1.0",
            "end"
        ).strip()

        if not text:

            messagebox.showwarning(
                "提示",
                "文字稿为空，没有保存。"
            )

            return

        transcript_path = self._transcript_path(
            path
        )

        try:

            transcript_path.write_text(
                text,
                encoding="utf-8"
            )

            self._log(
                f"参考文字稿已保存：{transcript_path}"
            )

            messagebox.showinfo(
                "保存成功",
                f"已保存到：\n{transcript_path}"
            )

        except Exception as exc:

            messagebox.showerror(
                "保存失败",
                str(exc)
            )

    # ========================================================
    # 模型加载
    # ========================================================

    def load_model(self):

        if self.busy:
            return

        model_dir = Path(
            self.model_dir_var.get()
        )

        if not model_dir.is_dir():

            messagebox.showerror(
                "模型目录错误",
                f"找不到模型目录：\n{model_dir}"
            )

            return

        self._set_busy(
            True,
            "正在加载 Qwen3-TTS 模型，请稍候……"
        )

        self._log(
            f"开始加载模型：{model_dir}"
        )

        threading.Thread(
            target=self._load_model_worker,
            args=(str(model_dir),),
            daemon=True
        ).start()

    def _load_model_worker(self, model_dir):

        try:

            import torch

            from qwen_tts import Qwen3TTSModel

            # CPU 线程设置
            try:

                torch.set_num_threads(16)

                torch.set_num_interop_threads(4)

            except RuntimeError:

                # 如果 PyTorch 已经初始化线程池，
                # 无法再次修改 interop 线程数。
                pass

            self._log(
                f"PyTorch：{torch.__version__}"
            )

            self._log(
                f"CUDA 可用：{torch.cuda.is_available()}"
            )

            self._log(
                "本工作台固定使用 CPU 推理。"
            )

            self._log(
                "正在载入模型权重……"
            )

            model = Qwen3TTSModel.from_pretrained(
                model_dir,
                device_map="cpu",
                dtype=torch.float32,
                attn_implementation="sdpa",
            )

            self.model = model

            self._log(
                "模型加载成功。"
            )

            self._set_busy(
                False,
                "模型已加载，可以生成语音。"
            )

        except Exception as exc:

            detail = traceback.format_exc()

            error_message = (
                f"{type(exc).__name__}: {exc}"
            )

            self._log(
                f"模型加载失败：{error_message}"
            )

            self._log(detail)

            self._set_busy(
                False,
                "模型加载失败，请查看日志。"
            )

            self.root.after(
                0,
                lambda msg=error_message: messagebox.showerror(
                    "模型加载失败",
                    msg + "\n\n详细信息请查看运行日志。"
                )
            )

    # ========================================================
    # 语音生成
    # ========================================================

    def _clear_target(self):

        self.target_text.delete(
            "1.0",
            "end"
        )

    def generate(self):

        if self.busy:
            return

        if self.model is None:

            messagebox.showwarning(
                "尚未加载模型",
                "请先点击“加载模型”。"
            )

            return

        # 获取台词
        text = self.target_text.get(
            "1.0",
            "end"
        ).strip()

        if not text:

            messagebox.showwarning(
                "缺少台词",
                "请先输入需要合成的台词。"
            )

            return

        # 获取角色
        role = self.role_var.get().strip()

        if not role:

            messagebox.showwarning(
                "缺少角色",
                "请先选择角色。"
            )

            return

        # 获取当前选择的参考音频
        ref_path = self._selected_reference_path()

        if ref_path is None or not ref_path.is_file():

            messagebox.showwarning(
                "缺少参考音频",
                "请先为当前角色选择一段参考音频。"
            )

            return

        # 克隆模式
        mode = self.mode_var.get()

        try:
            gen_params = {
                "temperature": float(self.temperature_var.get()),
                "top_k": int(self.top_k_var.get()),
                "top_p": float(self.top_p_var.get()),
                "repetition_penalty": float(self.repetition_penalty_var.get()),
                "max_new_tokens": int(self.max_new_tokens_var.get()),
                "do_sample": bool(self.do_sample_var.get()),
            }
            if not (0 < gen_params["temperature"] <= 5): raise ValueError("Temperature 必须在 0 到 5 之间。")
            if gen_params["top_k"] < 1: raise ValueError("Top K 必须大于等于 1。")
            if not (0 < gen_params["top_p"] <= 1): raise ValueError("Top P 必须在 0 到 1 之间。")
            if gen_params["repetition_penalty"] <= 0: raise ValueError("Repetition Penalty 必须大于 0。")
            if gen_params["max_new_tokens"] < 2: raise ValueError("Max New Tokens 必须大于等于 2。")
        except Exception as exc:
            messagebox.showerror("生成参数错误", str(exc))
            return

        # 参考文字稿
        ref_text = self.ref_text.get(
            "1.0",
            "end"
        ).strip()

        if mode == "ICL" and not ref_text:

            messagebox.showwarning(
                "缺少参考文字稿",
                "ICL 模式必须填写与所选参考音频准确对应的文字稿。\n"
                "也可以切换回推荐的 XVector 模式。"
            )

            return

        # 生成语言
        language = self.language_var.get()

        # 输出目录
        output_dir = Path(
            self.output_dir_var.get()
        )

        output_dir.mkdir(
            parents=True,
            exist_ok=True
        )

        # 输出文件名
        custom_name = self.output_name_var.get().strip()

        if custom_name:

            stem = self._safe_name(
                custom_name
            )

        else:

            timestamp = datetime.now().strftime(
                "%Y%m%d_%H%M%S"
            )

            stem = (
                f"{self._safe_name(role)}_{timestamp}"
            )

        output_path = (
            output_dir
            / f"{stem}.wav"
        )

        # 避免覆盖已有文件
        if output_path.exists():

            suffix = datetime.now().strftime(
                "%H%M%S_%f"
            )

            output_path = (
                output_dir
                / f"{stem}_{suffix}.wav"
            )

        # 保存当前角色的参考音频选择
        self.role_last_selection[role] = (
            self.reference_var.get()
        )

        # 锁定界面
        self._set_busy(
            True,
            "正在生成语音……CPU 推理可能需要一些时间。"
        )

        self._log("=" * 55)

        self._log(
            f"角色：{role}"
        )

        self._log(
            f"参考音频：{ref_path}"
        )

        self._log(
            f"模式：{mode}"
        )

        self._log(
            f"生成语言：{language}"
        )

        self._log(
            f"目标台词：{text}"
        )

        self._log(
            f"输出文件：{output_path}"
        )

        # 后台线程执行生成
        threading.Thread(
            target=self._generate_worker,
            args=(
                text,
                language,
                str(ref_path),
                ref_text,
                mode,
                str(output_path),
                gen_params
            ),
            daemon=True
        ).start()

    def _generate_worker(
        self,
        text,
        language,
        ref_audio,
        ref_text,
        mode,
        output_path,
        gen_params
    ):

        try:

            import soundfile as sf

            self._log(
                "开始调用 Qwen3-TTS……"
            )

            token_capture = {"count": None}
            core_model = getattr(self.model, "model", None)
            original_generate = getattr(core_model, "generate", None)
            if callable(original_generate):
                def counted_generate(*args, **kwargs):
                    result = original_generate(*args, **kwargs)
                    try:
                        batches = result[0]
                        if batches:
                            codes = batches[0]
                            token_capture["count"] = int(codes.numel()) if hasattr(codes, "numel") else len(codes)
                    except Exception:
                        pass
                    return result
                core_model.generate = counted_generate

            if mode == "XVector":
                self._log("使用 XVector 模式：仅使用参考音频提取说话人特征。")
                wavs, sr = self.model.generate_voice_clone(
                    text=text, language=language, ref_audio=ref_audio,
                    x_vector_only_mode=True, **gen_params
                )
            else:
                self._log("使用 ICL 模式：使用参考音频、参考文字稿及说话人特征。")
                wavs, sr = self.model.generate_voice_clone(
                    text=text, language=language, ref_audio=ref_audio,
                    ref_text=ref_text, x_vector_only_mode=False, **gen_params
                )

            if callable(original_generate):
                core_model.generate = original_generate

            # 检查生成结果
            if wavs is None or len(wavs) == 0:

                raise RuntimeError(
                    "模型没有返回音频数据。"
                )

            # 保存音频
            sf.write(
                output_path,
                wavs[0],
                sr
            )

            duration = (
                len(wavs[0]) / sr
            )

            self._log(
                f"生成成功：{output_path}"
            )

            self._log(
                f"采样率：{sr} Hz"
            )

            elapsed = max(time.monotonic() - (self.task_started_at or time.monotonic()), 0.001)
            token_count = token_capture["count"]
            token_speed = f"{token_count / elapsed:.2f}" if token_count is not None else "未能读取"
            rtf = elapsed / duration if duration > 0 else 0.0
            self._log(f"音频时长：{duration:.2f} 秒")
            self._log(f"输入字符数：{len(text)}")
            self._log(f"Codec Token ID 数：{token_count if token_count is not None else '当前接口未能读取'}")
            self._log(f"总生成耗时：{elapsed:.2f} 秒；Token ID/s：{token_speed}；RTF：{rtf:.2f}")
            self.root.after(0, lambda: self._show_generation_stats(len(text), token_count, token_speed, duration, elapsed, rtf))

            self._set_busy(
                False,
                f"生成完成：{Path(output_path).name}"
            )

            self.root.after(
                0,
                lambda path=output_path: messagebox.showinfo(
                    "生成完成",
                    f"语音已生成：\n{path}"
                )
            )

        except Exception as exc:

            detail = traceback.format_exc()

            error_message = (
                f"{type(exc).__name__}: {exc}"
            )

            self._log(
                f"生成失败：{error_message}"
            )

            self._log(detail)

            self._set_busy(
                False,
                "生成失败，请查看日志。"
            )

            self.root.after(
                0,
                lambda msg=error_message: messagebox.showerror(
                    "生成失败",
                    msg + "\n\n详细信息请查看运行日志。"
                )
            )

    def _tick_elapsed(self):
        if not self.busy or self.task_started_at is None:
            return
        elapsed = max(0, int(time.monotonic() - self.task_started_at))
        mm, ss = divmod(elapsed, 60)
        hh, mm = divmod(mm, 60)
        self.elapsed_var.set(f"{hh:02d}:{mm:02d}:{ss:02d}" if hh else f"{mm:02d}:{ss:02d}")
        self.root.after(500, self._tick_elapsed)

    def _show_generation_stats(self, chars, tokens, token_speed, audio_duration, elapsed, rtf):
        self.stats_chars_var.set(str(chars))
        self.stats_tokens_var.set(str(tokens) if tokens is not None else "未读取")
        self.stats_token_speed_var.set(token_speed)
        self.stats_audio_var.set(f"{audio_duration:.2f} 秒")
        self.stats_elapsed_var.set(f"{elapsed:.2f} 秒")
        self.stats_rtf_var.set(f"{rtf:.2f}")
        self.progress_note_var.set("生成完成；进度条仅表示任务状态，不代表百分比。")
        self.elapsed_var.set(f"{elapsed:.2f}s")

    # ========================================================
    # 关闭程序
    # ========================================================

    def _on_close(self):

        if self.busy:

            close = messagebox.askyesno(
                "任务正在运行",
                "模型正在加载或生成语音。仍要关闭工作台吗？"
            )

            if not close:
                return

        self.root.destroy()


# ============================================================
# 程序入口
# ============================================================

def main():

    root = tk.Tk()

    app = VoiceWorkbench(
        root
    )

    root.mainloop()


if __name__ == "__main__":

    main()
