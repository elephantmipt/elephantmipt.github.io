---
title: Implicit Generation and Modeling with Energy-Based Models – paper summary.
date: 2021-03-11
author: Nikita Balagansky
tags:
 - generative models
 - energy-based models
 - paper summary
---

> Proposed a new method for training energy-based models.

[Link to a paper](https://papers.nips.cc/paper/2019/file/378a063b8fdb1db941e34f4bde584c7d-Paper.pdf)

## What?

Proposed a new method for training energy-based models.

The authors proposed to avoid sampling from distribution via Langevin dynamics.
One step of optimization is:

$$\tilde{\mathbf{x}}^{k}=\tilde{\mathbf{x}}^{k-1}-\frac{\lambda}{2} \nabla_{\mathbf{x}} E_{\theta}\left(\tilde{\mathbf{x}}^{k^{\sim} 1}\right)+\omega^{k}, \omega^{k} \sim \mathcal{N}(0, \lambda)$$

The full algorithm below:

![algo](/assets/implicit_generation_and_modeling_with_energy_based_models_paper_summary/algo.png)

## Why?

Overall, the idea of an energy-based model is not new, but there are some problems with sampling,
as the

$$p(x) = \dfrac{\operatorname{exp}(-E_\theta (x))}{Z(\theta)}$$

, where $Z(\theta) = \int \exp(-E_\theta (x)) d x$ is a Z-sum. This integral can be find
via MCMC, but it's not efficient. So instead of maximizing probability authors took gradient directly from $E(\theta)$

## Results

### Image Generation

For the experiments, they use datasets with small images like CIFAR10 (32x32 images), ImageNet32x32, and ImageNet128x128.

They tried conditional image generation and simple image generation.

The architecture of the model is ResNet with conditional gains and biases per class.

![results table](/assets/implicit_generation_and_modeling_with_energy_based_models_paper_summary/results_table.png)

### Out-of-Distribution Generalization

The authors also explored that most of the generative models (VAE, PixelCNN++, and Glow) are unable to
generalize, that test data is from the same distribution with train data. But EBM (proposed model) is quite good at this task.

![Out of domain hist](/assets/implicit_generation_and_modeling_with_energy_based_models_paper_summary/out_of_domain_hist.png)

"AUROC scores of out of distribution classification on different datasets. Only our model gets better than chance classification."

![Out of domain hist](/assets/implicit_generation_and_modeling_with_energy_based_models_paper_summary/out_of_domain_table.png)

## Code example

```python
# from https://github.com/rosinality/igebm-pytorch/blob/master/train.py#L111

for i, (pos_img, pos_id) in loader:
    pos_img, pos_id = pos_img.to(device), pos_id.to(device)

    neg_img, neg_id = sample_buffer(buffer, pos_img.shape[0])
    neg_img.requires_grad = True

    requires_grad(parameters, False)
    model.eval()

    for k in tqdm(range(sample_step)):
        if noise.shape[0] != neg_img.shape[0]:
            noise = torch.randn(neg_img.shape[0], 3, 32, 32, device=device)

        noise.normal_(0, 0.005)
        neg_img.data.add_(noise.data)

        neg_out = model(neg_img, neg_id)
        neg_out.sum().backward()
        neg_img.grad.data.clamp_(-0.01, 0.01)

        neg_img.data.add_(-step_size, neg_img.grad.data)

        neg_img.grad.detach_()
        neg_img.grad.zero_()

        neg_img.data.clamp_(0, 1)

    neg_img = neg_img.detach()

    requires_grad(parameters, True)
    model.train()

    model.zero_grad()

    pos_out = model(pos_img, pos_id)
    neg_out = model(neg_img, neg_id)

    loss = alpha * (pos_out ** 2 + neg_out ** 2)
    loss = loss + (pos_out - neg_out)
    loss = loss.mean()
    loss.backward()
```

_Thanks for reading!_

<a href="https://www.buymeacoffee.com/elephantmipt" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>
