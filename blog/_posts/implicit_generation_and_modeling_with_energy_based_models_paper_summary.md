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

Authors proposed to avoid sampling from distribution via Langevin dynamics.
One step of optimization is:

$$\tilde{\mathbf{x}}^{k}=\tilde{\mathbf{x}}^{k-1}-\frac{\lambda}{2} \nabla_{\mathbf{x}} E_{\theta}\left(\tilde{\mathbf{x}}^{k^{\sim} 1}\right)+\omega^{k}, \omega^{k} \sim \mathcal{N}(0, \lambda)$$

The full alorithm bellow:

![algo](/assets/implicit_generation_and_modeling_with_energy_based_models_paper_summary/algo.png)

## Why?

Overall, the idea of energy based model is not new, but there is some problems with sampling,
as the

$$p(x) = \dfrac{\operatorname{exp}(-E_\theta (x))}{Z(\theta)}$$

, where $Z(\theta) = \int \exp(-E_\theta (x) d x$ is a Z-sum. This integral can be find
via MCMC, but it's not efficient. So instead of maximizing probability authors took gradient directly from $E(\theta)$

## Results

### Image Generation

For the experiments they use datasets with small images like CIFAR10 (32x32 images), ImageNet32x32 and ImageNet128x128.

They tried conditional image generation and simple image generation.

The architecture of the model is ResNet with conditional gains and biases in per class.

![results table](/assets/implicit_generation_and_modeling_with_energy_based_models_paper_summary/results_table.png)

### Out-of-Distribution Generalization

Authors also explored that most of the generative models (VAE, PixelCNN++ and Glow) are unable to
generalize, that test data is from the same distribution with a train data. But EBM (proposed model) is quite good at this task.

![Out of domain hist](/assets/implicit_generation_and_modeling_with_energy_based_models_paper_summary/out_of_domain_hist.png)

"AUROC scores of out of distribution classification on differ- ent datasets. Only our model gets better than chance classification."

![Out of domain hist](/assets/implicit_generation_and_modeling_with_energy_based_models_paper_summary/out_of_domain_table.png)

## Code example

TODO...
