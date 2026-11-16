# CompanyTTS

Windows 本地角色语音工作台，当前以 **Qwen3-TTS Base + CPU 推理 + XVector 角色音色克隆** 为主线。

工作台使用 Tkinter，支持角色素材管理、每个角色选择多段参考音频、XVector / ICL 模式、生成参数调整、WAV 输出，以及生成耗时和 Codec Token 统计。

> 本项目只包含工作台代码和说明文档。Qwen3-TTS 模型权重、参考音频和生成结果不应提交到 Git 仓库。

## 目前功能

- 自动扫描 `references/<角色名>/` 下的角色目录。
- 每个角色独立列出参考音频，支持 WAV、MP3、FLAC、OGG、M4A、AAC。
- 记住当前程序会话中每个角色上次选择的参考音频。
- 显示参考音频时长、采样率、声道和文件大小。
- 支持 XVector（推荐）与 ICL 模式。
- ICL 模式读取参考音频旁边同名的 `.txt` 文字稿；XVector 不需要文字稿。
- 模型加载和语音生成在后台线程执行，避免 Tkinter 界面长时间无响应。
- 输出 WAV，自动避免覆盖已有同名文件。
- 新增生成监控：任务运行动画、累计耗时、输入字符数、生成音频时长、RTF。
- 尝试从 Qwen3-TTS 底层返回值统计实际 Codec Token ID 数量，并计算平均 Token ID/s。
- 新增 Qwen3-TTS 常用生成参数：Temperature、Top K、Top P、Repetition Penalty、Max New Tokens、do_sample。

## 环境要求

推荐按当前已验证的本地环境使用：

- Windows 10 / 11
- Python 3.12 x64
- Qwen3-TTS Base 模型：`Qwen3-TTS-12Hz-1.7B-Base`
- PyTorch CPU 版本
- Python 包：`qwen-tts`、`soundfile` 及其依赖

示例环境目录：

```text
D:\CompanyTTS\
├─ voice_workbench.py
├─ 启动语音工作台.bat
├─ references\
│  └─ 红叶\
│     ├─ 红叶_春节.ogg
│     └─ 红叶_春节.txt
├─ outputs\
└─ Qwen3TTS\
   ├─ .venv\
   └─ models\
      └─ Qwen3-TTS-12Hz-1.7B-Base\
```

## 启动

仓库保留原版 `voice_workbench.py`，新增左右分栏版本 `voice_workbench_split.py`。新版本将角色素材、参考文字稿和生成参数放在左栏，将台词编辑、生成操作、统计和日志放在右栏；顶部路径设置保持全宽。左右分隔条可拖动，左栏内容可独立纵向滚动。两版共用同一套模型、素材和输出目录，不会迁移或改动本地数据。

**新布局版本的 CMD 启动命令：**

```bat
"D:\\CompanyTTS\\Qwen3TTS\\.venv\\Scripts\\python.exe" "D:\\CompanyTTS\\voice_workbench_split.py"
```

建议始终使用 Qwen3TTS 独立虚拟环境，不要直接双击 Python 文件，以免 Windows 调用到其他 Python 环境。

CMD 启动命令：

```bat
"D:\CompanyTTS\Qwen3TTS\.venv\Scripts\python.exe" "D:\CompanyTTS\voice_workbench.py"
```

如果使用启动 BAT，内容如下：

```bat
@echo off
chcp 65001 >nul
title Qwen3-TTS 语音工作台
cd /d "D:\CompanyTTS"
"Qwen3TTS\.venv\Scripts\python.exe" "voice_workbench.py"
if errorlevel 1 pause
```

## 角色参考素材

在 `references` 下为每个角色建立独立文件夹：

```text
references\
├─ 红叶\
│  ├─ 红叶_春节.ogg
│  ├─ 红叶_春节.txt
│  ├─ 红叶_日常.wav
│  └─ 红叶_日常.txt
└─ 其他角色\
   └─ reference.wav
```

文字稿必须与对应音频内容准确匹配。文件名相同、扩展名为 `.txt` 的文件会被自动识别。XVector 模式不读取参考文字稿；ICL 模式要求填写准确文字稿。

素材建议：尽量选择单一说话人、无背景音乐、无明显混响和噪声、没有其他角色插话的片段。不要把不同角色的声音混在同一个参考文件中。

## 生成模式

### XVector（默认推荐）

只从参考音频提取说话人特征，不要求参考文字稿。适合先快速比较每一段参考音频对角色音色的还原效果。

### ICL

同时使用参考音频、参考文本及语音编码。参考文字稿必须准确对应所选音频。ICL 与 XVector 的表现因角色素材而异，建议用同一段台词进行 A/B 对比。

## 高级生成参数

工作台将参数传递给 Qwen3-TTS 的 `generate_voice_clone()`：

| 参数 | 默认值 | 作用 |
|---|---:|---|
| Temperature | 0.9 | 采样随机性 |
| Top K | 50 | Top-K 采样范围 |
| Top P | 1.0 | Nucleus 采样阈值 |
| Repetition Penalty | 1.05 | 重复惩罚 |
| Max New Tokens | 2048 | 最大生成 Codec Token 数 |
| do_sample | 开启 | 是否启用采样 |

这些参数不是“越高越好”。建议一次只改变一个参数，并保留相同参考音频和测试台词，避免无法判断变化来源。参数设置会影响后续生成，但当前版本不会把不同角色的参数自动保存为独立预设。

## 进度与统计说明

- 进度条目前采用**不定长运行动画**，用于表示任务仍在执行。
- 当前使用的高层 `generate_voice_clone()` 接口没有向工作台提供可靠的逐 Token 进度回调，因此界面不会伪造 35%、70% 等百分比。
- 生成结束后，工作台会尝试从底层模型返回的 Codec 序列读取 Token ID 数量。该数字是返回序列中 Codec Token ID 元素的数量，包含序列中各码本的 ID，不等同于输入文字 Token 数。
- Token ID/s 是总 Codec Token ID 数除以本次生成耗时得到的平均值，不是实时速度。
- 音频时长由生成的波形长度和采样率计算。
- RTF = 生成耗时 ÷ 音频时长。数值越低，代表相对生成速度越快。
- 若所安装的 Qwen3-TTS 版本内部返回结构变化，Token 统计可能显示“未读取”；这不影响正常语音生成。

## 输出

默认写入 `outputs\`，文件格式为 WAV。若指定文件名已存在，工作台会追加时间后缀，避免覆盖旧音频。

## 常见问题

### 找不到 `qwen_tts`

通常是启动时选错 Python 环境。检查并使用：

```cmd
"D:\CompanyTTS\Qwen3TTS\.venv\Scripts\python.exe" -c "import sys; print(sys.executable); import qwen_tts; print(qwen_tts.__file__)"
```

确认导入成功后，再用同一个 Python 解释器启动工作台。

### 找不到模型

检查模型目录是否包含 Qwen3-TTS 模型配置、权重和 speech tokenizer 相关文件。模型目录路径可在工作台顶部修改。

### ICL 生成失败

确认参考文字稿准确对应所选参考音频，并且文字稿不是空白。若只是比较角色音色，可以切换到 XVector。

### CPU 生成较慢

这是预期现象。工作台不会使用 CUDA；生成时间会受输入长度、模型、CPU 线程和参数影响。不要为了提速而把 Qwen3-TTS 的模型文件移动到原来的 MeloTTS / OpenVoice 环境。

## 安全与仓库维护

不要提交以下文件：

- 模型权重和缓存目录（通常数 GB）。
- 个人或受版权保护的角色参考音频。
- 生成的 WAV 音频。
- 虚拟环境目录（`.venv`）。
- 包含访问令牌、密钥或个人路径的配置文件。

建议在本地使用 Git 忽略规则排除这些内容。当前仓库只维护工作台源码与项目说明。
