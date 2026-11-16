
# -*- coding: utf-8 -*-
"""
Qwen3-TTS 本地角色语音工作台
CPU 推理，默认使用 XVector 角色音色克隆。

目录结构：
D:\\CompanyTTS\\
    voice_workbench_split.py
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
            "Qwen3-TTS 角色语音工作台（左右分栏版）"
        )

        self.root.geometry("1280x860")
        self.root.minsize(1050, 700)

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

        outer = ttk.Frame(self.root, padding=10)
        outer.pack(fill="both", expand=True)

        # 顶部全宽路径设置
        paths = ttk.LabelFrame(outer, text="路径设置", padding=7)
        paths.pack(fill="x", pady=(0, 8))
        self._path_row(paths, 0, "模型目录：", self.model_dir_var, self._browse_model)
        self._path_row(paths, 1, "角色素材：", self.reference_dir_var, self._browse_reference)
        self._path_row(paths, 2, "输出目录：", self.output_dir_var, self._browse_output)

        # 左右分栏：左侧配置，右侧合成与监控
        split = ttk.Panedwindow(outer, orient="horizontal")
        split.pack(fill="both", expand=True)
        left_host = ttk.Frame(split)
        right = ttk.Frame(split, padding=(8, 0, 0, 0))
        split.add(left_host, weight=0)
        split.add(right, weight=1)

        # 左侧采用 Canvas + Scrollbar，窄窗口或较小屏幕可纵向滚动
        left_canvas = tk.Canvas(left_host, highlightthickness=0, width=420)
        left_scroll = ttk.Scrollbar(left_host, orient="vertical", command=left_canvas.yview)
        left_canvas.configure(yscrollcommand=left_scroll.set)
        left_scroll.pack(side="right", fill="y")
        left_canvas.pack(side="left", fill="both", expand=True)
        left = ttk.Frame(left_canvas)
        left_window = left_canvas.create_window((0, 0), window=left, anchor="nw")

        def _sync_left_scrollregion(_event=None):
            left_canvas.configure(scrollregion=left_canvas.bbox("all"))

        def _sync_left_width(event):
            left_canvas.itemconfigure(left_window, width=event.width)

        left.bind("<Configure>", _sync_left_scrollregion)
        left_canvas.bind("<Configure>", _sync_left_width)

        # 角色与参考音频
        ref_frame = ttk.LabelFrame(left, text="角色与参考音频", padding=8)
        ref_frame.pack(fill="x", pady=(0, 8))
        ttk.Label(ref_frame, text="角色：").grid(row=0, column=0, sticky="w", padx=(0, 5), pady=4)
        self.role_combo = ttk.Combobox(ref_frame, textvariable=self.role_var, state="readonly")
        self.role_combo.grid(row=0, column=1, sticky="ew", pady=4)
        self.role_combo.bind("<<ComboboxSelected>>", self._on_role_selected)
        ttk.Button(ref_frame, text="刷新", command=self.refresh_roles).grid(row=0, column=2, padx=4, pady=4)
        ttk.Button(ref_frame, text="打开角色文件夹", command=self._open_role_folder).grid(
            row=1, column=0, columnspan=3, sticky="ew", pady=(2, 5)
        )

        ttk.Label(ref_frame, text="参考音频：").grid(row=2, column=0, sticky="w", padx=(0, 5), pady=4)
        self.reference_combo = ttk.Combobox(ref_frame, textvariable=self.reference_var, state="readonly")
        self.reference_combo.grid(row=2, column=1, sticky="ew", pady=4)
        self.reference_combo.bind("<<ComboboxSelected>>", self._on_reference_selected)
        ttk.Button(ref_frame, text="打开音频位置", command=self._open_reference_location).grid(
            row=2, column=2, padx=4, pady=4
        )
        ttk.Label(ref_frame, textvariable=self.reference_info_var, foreground="#555555",
                  wraplength=380, justify="left").grid(
            row=3, column=0, columnspan=3, sticky="w", pady=(4, 2)
        )
        ref_frame.columnconfigure(1, weight=1)

        # 参考文字稿
        transcript_frame = ttk.LabelFrame(left, text="参考音频文字稿（仅 ICL 模式需要）", padding=8)
        transcript_frame.pack(fill="x", pady=(0, 8))
        self.ref_text = ScrolledText(transcript_frame, height=6, wrap="word")
        self.ref_text.pack(fill="both", expand=True)
        transcript_buttons = ttk.Frame(transcript_frame)
        transcript_buttons.pack(fill="x", pady=(5, 0))
        ttk.Button(transcript_buttons, text="读取文字稿", command=self._load_transcript).pack(
            fill="x", pady=2
        )
        ttk.Button(transcript_buttons, text="保存文字稿", command=self._save_transcript).pack(
            fill="x", pady=2
        )
        ttk.Label(transcript_frame,
                  text="文字稿保存在音频旁边的同名 TXT 文件中；XVector 不需要文字稿。",
                  foreground="#666666", wraplength=380, justify="left").pack(anchor="w", pady=(4, 0))

        # 生成选项
        options_frame = ttk.LabelFrame(left, text="生成设置", padding=8)
        options_frame.pack(fill="x", pady=(0, 8))
        ttk.Label(options_frame, text="生成语言：").pack(anchor="w")
        self.language_combo = ttk.Combobox(
            options_frame, textvariable=self.language_var, values=LANGUAGES,
            state="readonly"
        )
        self.language_combo.pack(fill="x", pady=(2, 8))
        ttk.Label(options_frame, text="克隆模式：").pack(anchor="w")
        ttk.Radiobutton(options_frame, text="XVector（推荐）", variable=self.mode_var,
                        value="XVector").pack(anchor="w", pady=2)
        ttk.Radiobutton(options_frame, text="ICL（需要准确文字稿）", variable=self.mode_var,
                        value="ICL").pack(anchor="w", pady=2)

        advanced = ttk.LabelFrame(left, text="高级生成参数", padding=8)
        advanced.pack(fill="x", pady=(0, 8))
        parameter_rows = [
            ("Temperature", self.temperature_var),
            ("Top K", self.top_k_var),
            ("Top P", self.top_p_var),
            ("Repetition Penalty", self.repetition_penalty_var),
            ("Max New Tokens", self.max_new_tokens_var),
        ]
        for label, variable in parameter_rows:
            row = ttk.Frame(advanced)
            row.pack(fill="x", pady=2)
            ttk.Label(row, text=label, width=21).pack(side="left")
            ttk.Entry(row, textvariable=variable, width=12).pack(side="right")
        ttk.Checkbutton(advanced, text="启用采样", variable=self.do_sample_var).pack(
            anchor="w", pady=(5, 0)
        )

        # 右侧：台词编辑为主要区域
        gen_frame = ttk.LabelFrame(right, text="语音生成", padding=8)
        gen_frame.pack(fill="both", expand=True)
        ttk.Label(gen_frame, text="待合成台词：").pack(anchor="w")
        self.target_text = ScrolledText(gen_frame, height=14, wrap="word")
        self.target_text.pack(fill="both", expand=True, pady=(4, 8))

        name_row = ttk.Frame(gen_frame)
        name_row.pack(fill="x", pady=(0, 7))
        ttk.Label(name_row, text="输出文件名：").pack(side="left")
        ttk.Entry(name_row, textvariable=self.output_name_var).pack(
            side="left", fill="x", expand=True, padx=5
        )
        ttk.Label(name_row, text="留空自动命名", foreground="#666666").pack(side="right")

        buttons = ttk.Frame(gen_frame)
        buttons.pack(fill="x", pady=(0, 8))
        self.load_button = ttk.Button(buttons, text="加载模型", command=self.load_model)
        self.load_button.pack(side="left")
        self.generate_button = ttk.Button(
            buttons, text="开始生成", command=self.generate, state="disabled"
        )
        self.generate_button.pack(side="left", padx=7)
        ttk.Button(buttons, text="打开输出目录", command=self._open_output_folder).pack(side="left")
        ttk.Button(buttons, text="清空台词", command=self._clear_target).pack(side="left", padx=7)

        monitor = ttk.LabelFrame(gen_frame, text="生成进度与统计", padding=8)
        monitor.pack(fill="x", pady=(0, 8))
        progress_row = ttk.Frame(monitor)
        progress_row.pack(fill="x")
        self.progressbar = ttk.Progressbar(progress_row, mode="indeterminate")
        self.progressbar.pack(side="left", fill="x", expand=True, padx=(0, 8))
        ttk.Label(progress_row, textvariable=self.elapsed_var, width=11).pack(side="right")
        ttk.Label(monitor, textvariable=self.progress_note_var, foreground="#666666").pack(
            anchor="w", pady=(3, 6)
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
            cell.grid(row=index // 3, column=index % 3, sticky="w", padx=(0, 18), pady=3)
            ttk.Label(cell, text=label, foreground="#666666").pack(anchor="w")
            ttk.Label(cell, textvariable=variable, font=("Segoe UI", 10, "bold")).pack(anchor="w")
        for column in range(3):
            stats.columnconfigure(column, weight=1)

        status_frame = ttk.Frame(gen_frame)
        status_frame.pack(fill="x", pady=(0, 6))
        ttk.Label(status_frame, text="状态：").pack(side="left")
        ttk.Label(status_frame, textvariable=self.status_var, wraplength=650,
                  justify="left").pack(side="left", fill="x", expand=True)

        log_frame = ttk.LabelFrame(gen_frame, text="运行日志", padding=6)
        log_frame.pack(fill="both", expand=True)
        self.log_text = ScrolledText(log_frame, height=8, wrap="word", state="disabled")
        self.log_text.pack(fill="both", expand=True)

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
