# AI & Computer Vision Model Audit: Protector AI 2.0
**Document Version**: 2.0.0  
**Date**: November 2026  
**Auditor**: Lead Computer Vision & Machine Learning Engineer  

---

## 1. AI Architecture Overview

Protector AI 2.0 utilizes a multi-model edge computing pipeline combining:
1. **Object & PPE Detection**: Ultralytics YOLOv8 trained on 25 industrial safety classes.
2. **Deep Face Detection & Landmarking**: YuNet CNN ONNX model with 5-point facial landmarking.
3. **Deep Facial Feature Embedding**: SFace Deep CNN generating 128D cosine feature embeddings.
4. **Autonomous Safety Copilot**: OpenRouter LLM + Local Safety Intelligence Agent.

```
                      +-----------------------------+
                      |     Raw Video Frame         |
                      +-----------------------------+
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
   +-----------------------+                   +-----------------------+
   |   YOLOv8 Inference    |                   |   YuNet Face Detector |
   |  Weights: best.pt     |                   |  Weights: yunet.onnx  |
   |  25 Industrial Classes|                   |  5-Point Landmarks    |
   +-----------------------+                   +-----------------------+
               |                                           |
               v                                           v
   +-----------------------+                   +-----------------------+
   |  PPE Violation Logic  |                   |  SFace 128D Embedder  |
   | (Hardhat, Vest, etc.) |                   | Aligned Cosine Match  |
   +-----------------------+                   +-----------------------+
               |                                           |
               +---------------------+---------------------+
                                     |
                                     v
                      +-----------------------------+
                      |   Verified Incident &       |
                      |   Attendance Persistence    |
                      +-----------------------------+
```

---

## 2. Model 1: YOLOv8 Industrial PPE Detection

- **Framework**: Ultralytics YOLOv8 / PyTorch 2.14+.
- **Weights File**: `D:\Downloads\best.pt` (87.6 MB) mirrored in `Backend/best.pt`.
- **Target Classes (25 categories)**:
  - `Person`, `Worker`, `Supervisor`
  - `Hardhat`, `NO-Hardhat`
  - `Safety Vest`, `NO-Safety Vest`
  - `Mask`, `NO-Mask`
  - `Gloves`, `NO-Gloves`
  - `Safety Boots`, `NO-Safety Boots`
  - `Safety Goggles`, `NO-Safety Goggles`
  - `Hazard Zone`, `Forklift`, `Machinery Breach`, etc.
- **Inference Performance**:
  - Input resolution: $640 \times 640$ pixels (auto-letterboxed).
  - Confidence Threshold: $0.45$ (reduces false positives while ensuring reliable detection).
  - IoU Threshold for NMS: $0.45$.
  - Inference Latency: $\approx 28 \text{ ms}$ on GPU (CUDA) / $\approx 55 \text{ ms}$ on multi-threaded CPU.

---

## 3. Model 2: YuNet CNN Deep Face Detector

- **Framework**: OpenCV DNN / ONNX Runtime.
- **Model File**: `Backend/models/face_detection_yunet_2023mar.onnx` (232 KB).
- **Architecture**: Lightweight single-stage deep convolutional neural network designed specifically for real-time edge face detection.
- **Capabilities**:
  - Detects faces across extreme roll, pitch, and yaw angles ($\pm 45^\circ$).
  - Operates reliably under low lighting, backlight glare, and shadow occlusions.
  - Generates precise **5-point facial landmarks**:
    1. Right eye center
    2. Left eye center
    3. Nose tip
    4. Right mouth corner
    5. Left mouth corner
- **Inference Latency**: $< 5 \text{ ms}$ on CPU.
- **Fallback**: Secondary multi-cascade Haar detector (`haarcascade_frontalface_default.xml` + `haarcascade_frontalface_alt2.xml`) with CLAHE contrast enhancement.

---

## 4. Model 3: SFace Deep Neural Feature Embedder

- **Framework**: OpenCV DNN (`cv2.FaceRecognizerSF`).
- **Model File**: `Backend/models/face_recognition_sface_2021dec.onnx` (38.6 MB).
- **Architecture**: SphereFace / MobileFaceNet deep convolutional network trained on large-scale facial datasets (MS-Celeb-1M / Casia-WebFace).
- **Feature Extraction & Alignment**:
  - Uses the 5 landmarks from YuNet to perform an affine transformation (`alignCrop`), aligning the eyes horizontally into a canonical $112 \times 112 \times 3$ BGR crop.
  - Generates a **128-dimensional unit-normalized feature vector** ($\|\mathbf{v}\|_2 = 1.0$).
- **Matching Metric**: Cosine Similarity:
  $$\cos\theta = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2} = \mathbf{u} \cdot \mathbf{v}$$
- **Strict Boundary Calibration**:
  - SFace standard identity boundary is $0.363$.
  - **Match Accuracy Percentage**:
    - $\cos\theta \ge 0.363 \implies \text{Accuracy} = 80.0\% + \frac{\cos\theta - 0.363}{1.0 - 0.363} \times 20.0\%$
    - $\cos\theta < 0.363 \implies \text{Accuracy} = \frac{\max(0, \cos\theta)}{0.363} \times 80.0\%$
  - Same Person: Cosine similarity $0.65 - 0.99 \implies 88\% - 100\%$ accuracy.
  - Different Person: Cosine similarity $< 0.30 \implies < 65\%$ accuracy (strictly rejected).
- **Data Augmentation**:
  - During enrollment, each face crop is augmented with horizontal reflection, $\pm 15\%$ exposure shifts, and $\pm 5\%$ zoom scaling to build a robust multi-vector identity centroid.

---

## 5. Model 4: Autonomous Safety Copilot

- **Cloud Provider**: OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`).
- **Primary LLM**: `deepseek/deepseek-chat` with fallback to `anthropic/claude-3.5-sonnet`.
- **Autonomous Local Intelligence Fallback**: If internet connectivity is interrupted, the local rule-based safety intelligence agent evaluates incident history, frequency distributions, and zone compliance scores, returning actionable OSHA compliance summaries with zero network dependencies.
