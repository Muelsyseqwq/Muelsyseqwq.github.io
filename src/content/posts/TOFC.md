---
title: Task-Oriented Feature Compression for Multimodal  Understanding via Device-Edge Co-Inference

author: Muelsyse

pubDatetime: 2026-08-18T10:21:03+08:00

featured: true

draft: false

tags:
  - LMM
  - LMM inference
  - Papper Reading

series: Paper Reading

ogImage: ../../assets/images/Papper_Reading/TOFC/TOFC.png

description: "阅读论文 'Task-Oriented Feature Compression for Multimodal  Understanding via Device-Edge Co-Inference ' 笔记。 "
---
![TOFC](../../assets/images/Papper_Reading/TOFC/TOFC.png)

## 这篇文章做了什么?

为了解决当前 LMM 用户使用时由于网络通信和推理时的计算而导致的延迟, 文章主要在端到端的传输上下功夫, 通过面向任务(Task-Oriented) 的压缩传输的信息(主要是视觉信息)来减少网络通信的时间和成本(计网中我们学过, 用户端的上行带宽一般很小), 同时减少 LMM 在 Server 的推理计算量, 在保证推理能力的同时提升速度, 从而提升了用户体验。不过文章似乎没有在极端的网络环境下做实验。

首先, 目前我们使用的 AI 基本上都是 'Server Only', 也就是用户端只管发, 计算推理全在 Server 端, 首先这样传输的数据压缩方式一般是传统的压缩方式(比如 pixel 的), 会有冗余信息比如好多像素都是在描述 `sky`, 最后真正对 inference 有用的可能很少, 同时这种压缩力度不够大(这些冗余信息可以压缩), 不仅在通信上会有延迟, 在计算上 LMM 通过 vision encoder 得到的视觉 token 更多, 导致 Server 端计算量很大, 从而导致面对实时性的任务表现效果很差。 我能想到的比如在具身的场景中中, 越快的推理意味着越快的行动。还有自动驾驶, 需要及时的推理保证紧急情况下的安全性。所以这篇文章使用了一个 LMM '云端协同推理' 的框架 (a device-edge co-inference framework),在此基础上提出了任务驱动的特征压缩方法。

![Fig1](../../assets/images/Papper_Reading/TOFC/Fig1.png)

### LMM 怎么工作的?

如下图所示(图片来自https://arxiv.org/abs/2402.12451), 现在的LMM 基本上由三个部分构成: a visual encoder, a language model, and an adapter module that connects visual inputs to the textual space. 将 encoder 得到的 vision feature 通过 adapter 变成 LLM 可以理解的 语义信息, 从而使用 LLM 进行推理, 这种方式利用了预训练的 vision encoder 比如 Clip, 推理也可以使用预训练的 LLM(不过也有自己重新训练的,像 LLaVA。)。这种方式是很高效且便宜的, 不再需要从头开始 train 一个 model。

![LMM-architecture](../../assets/images/Papper_Reading/TOFC/LMM-architecture.png)

### Task-Oriented Communication

有一个很明显的问题是我们发送的图片是给LLM看的, 传统的图片传输方式可能适合人, 但不一定适合 LLM, 我们应该传输 LLM 想要的数据保证其 inference 能力, 也就是 'Task-Oriented', 针对下游任务提供 LLM 需要的信息。原文中这样说 "extracts task-relevant information and transmits only the essential features to the edge server, which handles the extensive computation of model inference."

### 特征压缩

传统的方式数据压缩方式是通过压缩原始的图片来保证通信,这种 pixel 级别的方式太暴力了,会有上述的冗余信息的问题,并且可能会损失部分语义信息。 而减少 vision token 的方法大多是在 adapter 之后做的, 这时 vision token 的维度已经扩到的 LLM 的 latent space 了, 此时维度太高要传输的信息就太多了, 它只能降低服务器上的 LLM 计算开销，无法降低已经发生的设备—边缘传输量。应该尝试先传输 vision feature, 在 server 端进行投影和推理。针对上述这两个问题, 这篇文章采用 'feature compression' 并且在 Server 端进行投影。

## 方法

文章的整体架构图如下所示:

![Fig2](../../assets/images/Papper_Reading/TOFC/Fig2.png)

### System Model

输入是图片和文本指令, 后者由于数据小可以直接tokenizer, embedding 之后变成 token; 而图片本文采用了 LLaVA的方法, 原图像为 $h \times w \times 3$, 将其放大填充后切分成 $n_{h} \times n_{w}$ 个 tile, 在主实验中每个 tile 大小为 $384 \times 384$, 而 SigLIP 将每个 tile 切成 $14 \times 14$ 的 patch, 每一个 tile 一共就有 $27 \times 27 = 729$ 个token, 最后再加上一个被 resize 成 $384 \times 384$ 缩略图。所以一个图像被分成 $n_{p} \times p \times p \times 3$ 的大小,其中 $n_{p} = n_{h} \times n_{w} + 1$, $p = 384$。进入 encoder 之后变成 $n_{p} \times n_{v} \times d_{v}$,其中 $n_{v} = 729$, $d_{v} = 1152$。 这里有个问题是 $384$ 并不能整除 $14$, 不过 vit 的分割 patch 的实现是用卷积做的 `Conv2d(in_channels=3, out_channels=1152, kernel_size=14, stride=14, padding=0)` 大概类似这样, 最后得到的也就是 $((384 - 14) // 14) + 1 = 27$。

将encoder之后得到的 vision feature 送入 TOFC 的 特征融合模块, 得到聚合后的特征之后送入可选择的熵模型编码, 在 Server 端解码得到 vision feature, 再进行投影变成 token 传入 LLM。 先减少了feature, 再投影。既减少了传输时间, 也减少了(token减少)计算时间。

这篇文章提出的方法主要由三部分组成: Clustering-Based Feature Merging, Learnable Entropy Model-Based Codec,
Selective Entropy Model。

### Clustering-Based Feature Merging

图片处理后得到 $n_{p} \times n_{v} \times d_{v}$, 文章通过聚类将 $n_{v}$ 减少到 $n_{c}$。 文章采用了 DPC-KNN 的聚类方法, 成为聚类中心要符合两个条件: 局部密度高(这里选用K个), 与更高密度距离远, 前者表示你可以代表你周围的部分群体, 后者表示你是独特的, 你身边没有密度更高的来代表你。具体公式如下:

$$
\begin{equation}
\rho_{n,i}
=
\exp\left(
-\frac{1}{K}
\sum_{\boldsymbol{x}_{n,j}\in
\operatorname{KNN}(\boldsymbol{x}_{n,i},K)}
d\left(\boldsymbol{x}_{n,i},\boldsymbol{x}_{n,j}\right)^2
\right).
\tag{1}
\end{equation}
$$

$$
\begin{equation}
\delta_{n,i}
=
\begin{cases}
\displaystyle
\min_{j:\,\rho_{n,i}<\rho_{n,j}}
d\left(\boldsymbol{x}_{n,i},\boldsymbol{x}_{n,j}\right),
&
\text{if } \exists j,\ \rho_{n,i}<\rho_{n,j},
\\[6pt]
\displaystyle
\max_j
d\left(\boldsymbol{x}_{n,i},\boldsymbol{x}_{n,j}\right),
&
\text{otherwise}.
\end{cases}
\tag{2}
\end{equation}
$$

$\rho_{n,i}$ 表示第 $n$ 个 patch(/tile) 的第i个feature 和周边 K 和 feature 的平均密度大小(0~1)。比如第 $3$ 个 patch 的第 728 个 feature, 是 $1152$ 维的。 $\delta_{n,i}$表示与更高密度 feature 的距离, 使用两者乘积 $\rho_{n,i} \times \delta_{n,i}$ 来选择聚类中心。

最后对每个簇内的 feature 求平均得到融合的 feature **$y$**。

这种自适应的聚类的优势是 training-free, 并且自适应能够让相同的聚到一块, 这样的特征减少不会导致过分的语义信息丢失, 同时对于不同种类的图片具有很高的泛化性。

> [!NOTE] ✏️ A question
> 写到这里我突然有一个问题: 为什么一定要传图片? 为什么不传 image capation,因为我看 LLaVA 的第一篇论文中 GPT4 只看文本不看图片也能做的很好, 并且它的数据集也是 GPT4 不看图片生成的。answer: 不过需要人描述, 并且描述来的没有图片直观。 deepseek 的识图模式是怎么做的? 或者说可以用户传上去图片, model 先做 image capation, 然后再推理?这样不久避免了直接将vision feature转变成token 我之后去看看这个问题怎么回答。二编:deepseek 的识图模式是 OCR, 只能提取文字, 貌似最近出了多模态但是效果一般; 对于为什么不适用image capation 这个问题, 有点 何不食肉糜 的感觉了, 因为如果能够做好 image capation, 那模型就已经有了很好的多模态理解能力了, 那就可以直接使用了,没必要转成文字。

### Learnable Entropy Model-Based Codec

这里的整体思路跟 Variational Image Compression with a Scale Hyperprior 基本一致, [text](https://arxiv.org/abs/1802.01436)
首先解释一下什么是熵模型, 信息论中我们认为每个数据出现是有概率的, 即服从一定的分布, 真实的分布没法得到, 我们用熵模型来预测这个分布(本文使用拉普拉斯分布), 具体点是预测这个分布的参数。 有了分布就有可以熵编码了。

假设真实分布为 $P$, 理论最低平均码长是熵: $H(P)=- \sum_x P(x)\log_2P(x)$, 我们训练一个熵模型 $Q _\theta$ 去近似它, 那实际码长为 $\mathbb E_{x\sim P} [-\log_2Q_\theta(x)]$, 这个公式是交叉熵。可以分解为:

$$
\mathbb{E}_{P}\left[-\log_{2} Q_{\theta}(X)\right]
= H(P) + D_{\mathrm{KL}}\left(P \parallel Q_{\theta}\right)
$$

前者是数据的信息量, 后者是 KL 散度, 表示熵模型预测不准造成的额外码长。

我们得到的是 $n_{p} \times n_{v} \times d_{v}$,其中 $n_{v} = 729$, $d_{v} = 1152$, 引入超先验$z$ 通过一个神经网络 $h_a$ 得到, 都是浮点数, 如果全用浮点数编码的话, 比如 FP16, 消耗存储太大了, 这里使用有损编码, 先对数据量化 (Quantized) 再编码。

下面这版可直接粘贴到 Markdown。我修正了 `\miu`、下标转义和量化符号，并补充了 TOFC 后续使用 STE 的说明。

$z$ 是一种超先验辅助信息，可以理解为对待传输特征的“说明书”。如果没有 $z$，解码端就无法直接获得拉普拉斯分布的参数 $(\mu,b)$。一种做法是在编码端计算 $(\mu,b)$ 并直接传输，但它们的维度与 $y$ 处于同一量级，传输开销很大。因此，TOFC 只传输维度更小的量化超先验 $\bar z$，解码端再通过超先验合成网络 $h_s$ 得到：

$$
(\mu,b)=h_s(\bar z).
$$

对于量化，论文首先使用加性均匀噪声进行描述：

$$
\bar y=y+o,
\qquad
o\sim\mathcal U(-0.5,0.5).
$$

这是神经压缩中常见的量化近似。由于真正的取整操作不可导，训练时可以用加性均匀噪声近似量化误差；测试和实际编码时则执行真正的取整量化。

不过，TOFC 随后又在公式 (7) 和公式 (8) 中引入了直通估计器（STE）：

$$
\bar y=\operatorname{STE}(y-\mu)+\mu,
$$

$$
\bar z=\operatorname{STE}(z-\mu_{1/2})+\mu_{1/2}.
$$

STE 在前向传播时执行真正的取整，在反向传播时则近似令梯度直接通过。论文没有清楚解释均匀噪声与 STE 的具体分工，公开源码的训练配置主要采用无噪声概率估计与 STE 硬量化。

但是 文中后面又说使用的 STE 的 方式, forward 时看成是 round(·), backward 时看作恒等函数, 这样就可以方向传播了。 我看了源码两种实现是都有的, 但是训练脚本使用的是后者。

由于 $y$ 和 $z$ 都是被量化成 $y_offset$, $z_offset$, 我们的概率应该使用离散的概率 PMF, 也即是对一个数求其 (-0.5, 0.5) 的密度函数的积分, 得到离散的CDF。文中用了和均匀分布卷积的形式, 是一样的。

文中的 Loss 也是两个部分, Rate 和 Distortion, 其中 Distortion 是 LLM 的损失。

$$
\begin{equation}
\mathcal{L} = D + \lambda R.
\tag{4}
\end{equation}
$$

$$
\begin{equation}
D
=
-\frac{1}{T}
\sum_{t=1}^{T}
\log p\left(
x_{a,t}
\mid
x_{a,1},\ldots,x_{a,t-1}
\right).
\tag{5}
\end{equation}
$$

对于 $R$, 对于一个给定的图片来说, 理想熵是:

$$
\begin{equation}
\begin{aligned}
H(\bar{y},\bar{z})
&=
H(\bar{y}\mid\bar{z}) + H(\bar{z}) \\
&=
\mathbb{E}_{v_i\sim p_{v_i}}
\left[
-\log p_{\bar{y}\mid\bar{z}}
\left(\bar{y}\mid\bar{z},v_i\right)
-\log p_{\bar{z}}
\left(\bar{z}\mid v_i\right)
\right].
\end{aligned}
\tag{11}
\end{equation}
$$

但数据的真实分布不知道, 使用我们用神经网络预测的来代替: 这里应该是真实数据的概率, 对预测分布的熵。 准确的说:真实分布的熵，也就是知道真实分布时能够达到的理论最优平均码长，小于等于使用神经网络预测的概率分布编码真实数据时得到的平均码长。 这里的公式我觉得写的不好理解, 可以使用 $p$, $q$ 来区分真实分布和预测的分布的。

$$
\begin{equation}
\begin{aligned}
H(\bar{y},\bar{z})
\leq{}&
\mathbb{E}_{\bar{y}\sim p(\bar{y}\mid\bar{z})}
\left[
-\log p(\bar{y}\mid\bar{z})
\right] \\
&+
\mathbb{E}_{\bar{z}\sim p(\bar{z})}
\left[
-\log p(\bar{z})
\right].
\end{aligned}
\tag{12}
\end{equation}
$$

这个熵是大于真实熵的, 最后使用以下公式, 不过这里没有写求和可能是对于一个来说, 源码是有求和的。

$$
R
=
-\frac{1}{n_p n_c d_v}
\left(
\log p(\bar{y}\mid\bar{z})
+
\log p(\bar{z})
\right).
$$

```python
nbits = (
    torch.log(y_likelihoods).sum()
    + torch.log(z_likelihoods).sum()
) / -math.log(2)

self.rate = self.rate + nbits / y_likelihoods.numel()
```

写成下面的形式可能更好理解一点:

$$
R
=
-\frac{1}{n_p n_c d_v}
\left[
\sum_{i=1}^{n_p n_c d_v}
\log_2 p\left(\bar{y}_i \mid \bar{z}\right)
+
\sum_{j=1}^{n_p n_c d_v/16}
\log_2 p\left(\bar{z}_j\right)
\right].
$$

### MOE

图片是多样的, 单纯的一个熵模型编码所有特征的熵会大一点, 所以文章引入了MoE。

![MoE](../../assets/images/Papper_Reading/TOFC/MoE.png)

通过 Router 网络求得一个对 16 个专家的分数 通过带温度的 Softmax 变成权重 $w_{n,i}$, 权重和每个 Entropy Model 做点积, 最后得到最终的特征。 注意 train的时候是在一台设备进行的。推理的时候使用的权重计算最高的专家。

$$
\bar{\mathbf{y}}_{n,i}
=
\sum_{e=1}^{n_e}
w_{n,i}^{(e)}
\bar{\mathbf{y}}_{n,i}^{(e)} .
\tag{15}
$$

由于使用了多个专家, rate loss 也要求取平均值:

$$
R
=
-\frac{1}{n_p n_c d_v}
\sum_{e=1}^{n_e}
w_{n,i}^{(e)}
\left(
\log p\left(
\bar{\mathbf{y}}^{(e)}
\mid
\bar{\mathbf{z}}^{(e)}
\right)
+
\log p\left(
\bar{\mathbf{z}}^{(e)}
\right)
\right) .
\tag{16}
$$

权重计算公式如下:

$$
w_{n,i}^{(e)}
=
\frac{
\exp\left(s_{n,i}^{(e)}/T\right)
}{
\displaystyle
\sum_{e=1}^{n_e}
\exp\left(s_{n,i}^{(e)}/T\right)
} .
\tag{17}
$$

由于采用了MoE, 为了保证所有专家都能够参与, 引入了负载均衡损失:

$$
\mathcal{L}_{\mathrm{balance}}
=
\alpha
\sum_{e=1}^{n_e}
\left(
\frac{1}{n_p n_c}
\sum_{n=1}^{n_p}
\sum_{i=1}^{n_c}
w_{n,i}^{(e)}
-
\frac{1}{n_e}
\right)^2 .
\tag{18}
$$
## 思考
第一次看到方法的第二部分熵模型的时候一下子想到了生成模型, 像 VAE, DDPM, 神奇的是 在我翻阅参考文献时有这样一篇: '[Variational image compression with a scale hyperprior](https://arxiv.org/abs/1802.01436)', 第一句话就说 'We describe an end-to-end trainable model for image compression based on variational autoencoders.' 不禁让我思考 `生成` 和 `压缩` 的关系, 就目前我的知识而言, 我认为压缩类似于 'AutoEncoder', 生成是真正的 `VAE`, 同时压缩之后重建是为了让人看的清楚, 不损失人所捕捉的信息, 但是像这篇文章传输图片是给 LLM 看的, 是否就不需要像重建一样保证图像的人眼所见的损失? 只保留 LLM 需要的信息即可, 也就是说不需要达到优秀的重建效果, 那是否生成也可以? 既然熵模型也是利用神经网络预测分布, 跟 VAE 如出一辙, 那我们能否使用神经网络近似 image feature 的分布?  这样传输潜变量就可以了, demension 会低很多, 之后在 server 端生成 image token。 我认为 image feature 是低秩的, 不需要像1152维这样多, 所以潜变量的传输是有可能正确的。 但是有一个问题是 怎么保证信息不丢失? 我目前的理解是通过训练, 核心的特征是不会丢失的, 生成 LLM 的需要的 feature 就行了。 之后我在看看有没有别的文献做这个的。

我认为将这两件事联系到一起的很重要的观点是 *信息论*,  LLM 的 loss 就是交叉熵, 只是 predict next token, 预测的也是 下一个 token 的分布, 不过最后处理的时候让 label 处为1了。

## 二编

之前我对熵模型的理解有点问题, 准确来说 熵模型是一种减少传输 bit 数的方法, 使用预测的分布, 比如文中使用的是拉普拉斯分布, 根据预测的参数得到一张概率表, 比如 `0` 这个数 出现的概率是 `0.5`, 算数编码器根据这个概率表编码从而减少传输的信息, 用于变成更短的 bitstream, 跟 `AE`, `VAE`是有区别的, 并且并不需要采样, 只需要 通过 $\mu$ 恢复即可。具体如下图所示:

![熵编码](../../assets/images/Papper_Reading/TOFC/entropy.png)

不过对于降维我做了一些尝试, 说不定 `VAE` 可以用在这里。


### 我想验证的两个问题

TOFC 已经把每个 tile 的 729 个 visual token 聚成了 16 个，但每个 token 仍然有 1152 维。也就是说，聚类只压缩了 token 数量，没有直接回答通道维度是否也有冗余。我想继续检查两件事：

1. `[16,1152]` 的 feature 是否具有明显的低秩结构，能不能先降到 384、576 或 768 维，再恢复到 1152 维；
2. 能不能不传 TOFC 的量化特征 `y`，改为只传 AE/VAE 的连续 latent，或者 VQ-VAE 的离散 index，由 Server 端的 decoder 重建 feature。

先做 PCA，因为它不需要训练，很适合判断“低秩”这个前提是否成立。之后再比较 nonlinear AE、β-VAE 和 VQ-VAE。所有方案最后都生成了真实的 rANS bitstream，不是只拿维度比例估算通信量。

### 数据和比较口径

实验使用 COCO val 的 500 张图片，链路为：

```text
image
  -> SigLIP hidden_states[-2]
  -> DPC-KNN，729 tokens 合并为 16 tokens
  -> clustered feature [16,1152]
  -> 待测试的压缩方法
```

PCA 使用 400 张图片拟合，剩余 100 张测试；学习型模型再从这 400 张中分出 360 张训练和 40 张验证。划分按图片进行，同一张图片的 16 个 token 不会同时出现在训练集和测试集。

为了公平比较，下面 TOFC、PCA、AE、VAE 和 VQ-VAE 的结果都取同一批 100 张测试图。表中的 `B/图` 指一张图对应的 feature bitstream，不是 JPEG 文件大小。PCA 基、decoder、codebook 和概率表看作预先部署在 Device 与 Server 两端的模型参数，不计入每张图的 payload；TOFC 的网络权重也使用相同口径。

先看 TOFC baseline。聚类后的 `[16,1152]` feature 如果直接用 FP16 发送，需要：

$$
16\times1152\times2=36864\ \text{Bytes}.
$$

TOFC 的真实 rANS 码流包含 $z$ 和 $y$ 两部分，在这 100 张图上平均为 6025.56 B/图，解码特征与编码前特征的平均余弦相似度为 0.983878，MSE 为 0.083309。

### PCA：1152 维是不是太多了？

PCA 的结果确实显示出低秩结构。达到 90%、95% 和 99% 累计方差分别需要 386、591 和 944 维。只看未量化的 PCA 重建，768 维可以保留约 97.49% 的方差，平均余弦相似度为 0.972223。

但“降到 768 维”不等于“通信量自动减少到三分之二”。PCA 系数仍然是浮点数，还要量化和熵编码。因此我对 PCA latent 做了按分量标准化、均匀量化，再用 `GaussianConditional + rANS` 生成实际字节流，Server 端从码流解出 latent 后做逆 PCA。

在与 TOFC 接近的 6 KB/图附近，结果如下：

| 方法 | 量化步长 $q$ | payload（B/图） | 特征余弦 | MSE |
|---|---:|---:|---:|---:|
| TOFC | - | 6025.56 | **0.983878** | **0.083309** |
| PCA-384 | 0.018 | 5984.32 | 0.925363 | 0.437956 |
| PCA-576 | 0.11 | 6025.88 | 0.952076 | 0.286041 |
| PCA-768 | 0.29 | 6024.36 | **0.968807** | **0.186376** |

![PCA 量化后的实际码率与特征余弦](../../assets/images/Papper_Reading/TOFC/PCA-rate-distortion.png)

这张图里 TOFC 的点明显高于三条 PCA 曲线。即使给 PCA 几乎相同的字节数，重建质量仍然追不上 TOFC，因为 PCA 截断本身已经丢掉了一部分信息。384 维太激进，768 维相对合理。比如 `768D, q=0.40` 的 payload 是 5318.20 B/图，比 TOFC 少 11.74%，余弦仍有 0.964708。

所以 PCA 给出的答案是：1152 维在统计上有冗余，可以降维；但被舍弃的低方差方向不一定对 LMM 任务无用。“统计冗余”和“任务冗余”不能画等号。

### 非线性 AE 和 β-VAE

最开始我直接训练了一个 MLP AutoEncoder，结果训练误差不断下降，测试余弦却只有 0.916 左右，很明显是小数据过拟合。后来改成 PCA 初始化的线性主干，只让一个 rank-32 的非线性残差学习 PCA 没有覆盖的部分。这样至少不会因为训练不稳定而大幅输给 PCA。

在约 6 KB/图时，连续 latent 模型的结果是：

| 方法 | payload（B/图） | 特征余弦 | MSE |
|---|---:|---:|---:|
| TOFC | 6025.56 | **0.983878** | **0.083309** |
| PCA-768 | 6024.36 | 0.968807 | 0.186376 |
| nonlinear AE-768 | 6045.72 | 0.968359 | 0.189027 |
| β-VAE-768 | 6045.56 | 0.968355 | 0.189041 |

AE 和 VAE 基本贴着 PCA，没有得到额外收益。β-VAE 还测试了 `β=0.0001 / 0.001 / 0.01`，768 维三组实验的最佳验证 checkpoint 都停在 epoch 0，也就是 PCA 初始化的位置。至少在目前这 360 张训练图上，KL 正则和随机采样没有让 latent 更适合压缩。

这个负结果挺有用。把 decoder 换成“生成式模型”并不会自动变好，训练数据、先验分布和 loss 都得与任务对齐。

### VQ-VAE：只传离散 index

VQ-VAE 更接近我最初设想的“只传关键信息”。实验里先把 feature 编成 768 维 latent，再把每 2 维分为一组，所以每个 token 有 384 个 codebook index；一张图有 16 个 token，总共需要编码 6144 个 index。Server 收到 rANS 码流后，先恢复 index，再查 codebook 并通过 decoder 生成 1152 维 feature。

以 `K=64` 为例，一个 index 的名义信息量是 6 bit：

$$
16\times384\times6/8=4608\ \text{Bytes}.
$$

实际 rANS payload 为 4639.00 B/图，和这个估算接近。它比 TOFC 少传 1386.56 B，也就是 23.01%，但特征余弦从 0.983878 降到了 0.956525。

| 方法 | payload（B/图） | 相对 TOFC 的传输变化 | 特征余弦 | 相对 TOFC 的余弦下降 |
|---|---:|---:|---:|---:|
| TOFC | 6025.56 | - | **0.983878** | - |
| VQ-VAE-768，K=16 | 3240.28 | **减少 46.22%** | 0.933864 | 0.050014 |
| VQ-VAE-768，K=64 | 4639.00 | **减少 23.01%** | 0.956525 | 0.027353 |
| VQ-VAE-768，K=256 | 6144.52 | 增加 1.97% | 0.965391 | 0.018487 |

`K=256` 已经比 TOFC 传得更多，余弦还更低，没有继续使用的理由。`K=64` 是当前比较均衡的点；`K=16` 接近把传输量砍半，但 feature 损失也更明显。

为了判断 VQ 的收益是不是单纯来自“用了更少的 bit”，我又补了同码率 PCA：

| 码率区间 | VQ-VAE-768 | 同码率 PCA | VQ - PCA 余弦 |
|---|---:|---:|---:|
| 约 3.24 KB/图 | **0.933864** | 0.926411 | **+0.007453** |
| 约 4.65 KB/图 | 0.956525 | **0.956810** | -0.000284 |
| 约 6.16 KB/图 | 0.965391 | **0.969237** | -0.003846 |

![PCA、AE、VAE、VQ-VAE 与 TOFC 的率失真比较](../../assets/images/Papper_Reading/TOFC/learned-rate-distortion.png)

VQ-VAE 只在最激进的 3.24 KB/图区间明确超过同码率 PCA；到了中高码率，两者持平或 PCA 更好。离散 latent 的价值目前出现在低码率端，还不能说 VQ-VAE 全面优于 PCA，更没有超过 TOFC。

### 目前能下的结论

这组实验确认了工程链路是可行的：Device 可以不传原始的 1152 维 feature，只传量化后的低维 latent 或离散 VQ index，Server 再恢复出 `[16,1152]` feature。PCA 和 VQ-VAE 也都说明 1152 维存在统计冗余，768 维是目前更稳妥的 bottleneck。

但我现在还不能回答最重要的问题：余弦从 0.9839 降到 0.9565 后，OCR、计数、VQA 到底会掉多少。低方差方向可能恰好保存了文字、小目标或计数信息，只看 MSE 和 cosine 判断不了。

> [!WARNING] 当前实验的边界
> 学习型模型只有 360 张训练图和 40 张验证图；目前测到的是 feature-space 重建，不是 Qwen 的下游任务准确率。我的 RTX 4060 Laptop 只有 8 GB 显存，无法直接运行 FP16 的 LLaVA-OneVision-Qwen2-7B 完整链路。后续可以尝试 4-bit、CPU offload 和 batch size 1 做小规模验证，正式 benchmark 仍然需要更大的显卡。

下一步如果继续做 VQ，我会先选 `VQ-VAE-768, group_dim=2, K=16/64`，并把训练目标从单纯的 feature MSE 改成任务保持：加入 `mm_projector` 输出蒸馏、Qwen hidden state/logits 蒸馏和 rate loss。只有下游任务不明显下降，“1152 维对 LMM 来说是冗余的”这个判断才算真正成立。
