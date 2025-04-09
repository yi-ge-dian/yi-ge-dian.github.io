---
title: "第四届全球数据库大赛赛道1：云原生共享内存数据库性能优化"
date: "2024-04-01"
updated: "2024-04-01"
update_time: true
cover: /img/competition/2022-Fourth-Global-Database-Competition-Track-1/featured.jpeg
thumbnail: /img/competition/2022-Fourth-Global-Database-Competition-Track-1/featured.jpeg
tags:
    - RDMA
    - 数据库
    - Cloud Native
categories: competition
toc: true
---

官网链接：[第四届全球数据库大赛赛道1：云原生共享内存数据库性能优化](https://tianchi.aliyun.com/competition/entrance/531979/introduction?spm=a2c22.12281925.0.0.1e557137HsIUXu)

最终结果 QPS：百万级别

<article class="message is-info">
  <div class="message-header">
    <p><i class="fas fa-image"></i> &nbsp; 关于头图</p>
  </div>
  <div class="message-body">
    头图来自 <a href="https://tianchi.aliyun.com/competition/entrance/531979/introduction?spm=a2c22.12281925.0.0.1e557137HsIUXu" target="_blank">阿里云</a>。
  </div>
</article>

<!-- more -->

# 初赛

初赛要求实现一个支持远程内存池的高性能数据库。我们将提供以下的运行环境（共两个节点：节点 A 和节点 B。节点 A 包含 16 vCPU和 8 GB内存，节点B 包含 4 vCPU 和 32 GB 的远程内存池，节点 A 和节点 B 之间通过 eRDMA 互联）。

选手需要实现一个高效的 kv 存储引擎，支持 Write、Read 接口。测试程序将部署在节点A上，因此选手程序需要优先利用节点A的内存。当内存不足时，选手程序需要支持通过 eRDMA 访问节点B 32 GB的远程内存池。虽然RDMA编程与传统网络编程有非常多的相似之处，但考虑到很多选手未接触过RDMA，我们会提供Sample Codes（包含eRDMA实现和接口标准），实现节点A和节点B的RDMA互联，支持基本的内存读写操作。

引擎使用的本地内存和远端内存限制在 8 GB 和 32 GB。 每个线程分别插入 12 M个Key大小为 16 Bytes，Value为 128 Bytes的KV对象，接着以 7 ：1 的读写比例访问调用 64 M次。数据符合Zipfian热点分布，其中90% 的读访问具有热点的特征，大部分的读访问集中在少量的Key上面。

初赛：Write、Read 接口

复赛：Delete 接口

## Demo 架构

![demo](/img/competition/2022-Fourth-Global-Database-Competition-Track-1/assets/demo.webp)

Local Engine 由索引、远程内存管理模块和 RDMA 通信模块组成。

Remote Engine 由 RDMA 通信模块和内存管理模块组成。

Demo 是一种 K/V 分离架构，将 Key 及索引保存在本地节点，将 Value 保存在远程内存池中，通过远程内存地址进行读写。

## 存在的问题

在性能上，首先，并发性能弱，虽然为索引做了 Hash 分区，但是远程内存管理模块和 RDMA 模块都不支持多线程同时操作。

其次，RDMA 通信开销大。每条 K/V 数据的读写都需要进行一次 RDMA 通信，通信次数过高。而在内存开销上，其使用的索引需要的内存超过了本地的 8GB 内存，也就无法在测试平台运行。

## 如何进行优化

1. 减少索引的内存占用。我们在初赛前期，选用了 HAT-trie 这样一个前缀树方案作为我们的索引。
2. 其次我们优化了部分并发，将 RDMA 模块也分为了多个实例，根据 Hash 进行分区，提高了并发度。
3. 最后我们队伍也是最快出分的几支队伍之一。

## 遇到的瓶颈

但是，我们很快到达了性能瓶颈，我们在 Demo 的架构上不断进行修改，例如使用 LRU 缓存、批量写数据等，但效果都不好。我们在这个分数段挣扎了半个月之久。

RDMA 的特性可以看到其写 128  字节大小数据块和写 4K 字节数据块的延迟基本是一样的。 

应用程序使用 RDMA 传输的不应该是消息，而应该是数据，整页整页的数据。这和传统的 TCP/IP 协议下的通信是完全不同的。

设计出了一个新的基于 RDMA 的 KV 存储架构 

- 以页为单位进行远程内存读写
- 将本地空闲的内存作为页缓存

## 新的架构

首先我们对于 key 做了 hash，分为不同的 Shard 做并发。

![shard](/img/competition/2022-Fourth-Global-Database-Competition-Track-1/assets/shard.webp)

而在每一个 Shard 内部

![内部](/img/competition/2022-Fourth-Global-Database-Competition-Track-1/assets/内部.webp)

在 Shard 内部，有多个模块，我们将这些模块分为索引层和存储管理层。

### 索引层

Index 是数据的索引，索引存储每个 KV entry 的元数据，包括 Value 所在的 Page_id，在
Page 中的偏移量和 Value 的长度

我们对数据进行了分页管理，所以我们需要这样一个页表，页表会记录该页在远程内存中的起始地址，记录这块地址的 rkey，并且如果该页被本地缓存了的话，会记录其在本地的 frame id

### 存储管理层

Frame 页帧，即数据页在本地的缓存，Value 所在的页面如果在本地缓存中，则通过 frame_id + 偏移量读取 Value，

如果不在本地缓存中，则通过 RDMA 通信层从远程内存中将页面读取到本地缓存。

Cache replacement 是缓存淘汰算法，其根据淘汰算法选择被淘汰的页面。

Write Cache 是用于写新数据的流程，其在一页数据被写满后，向远程节点申请一块新的内存，并将数据写进去。

## 新架构所带来的性能

在实现了新架构后，性能得到了极大的提高，到达了 demo 性能的 20 倍左右。这证明了我们团队目前设计的方向是正确的，但是想要达到更好的成绩，我们需要更多更为细致的努力。

我们做了以下几方面的努力，包括并发的设计，索引结构的设计，RDMA 的优化，淘汰策略优化，KV/Cache 的设计。这里我们只介绍前两个。 

### 并发的设计

shard 级别的并发已经不能够满足需求了，需要做到更加细粒度的并发。于是我们为 Shard 内每个模块单独设计了并发控制，并使用原子变量等方式减少并发的开销。

- 索引：使用分段锁进行并发
- Page Table：为每个 Page 做细粒度的并发
- Write Cache：使用原子变量进行并发 append
- Frame Manager：依靠 Page Table 的锁做并发。

### 索引的设计 

- 我们考虑两个要素：性能和内存消耗。索引的性能会影响 K/V 数据读写的速度，而索引的内存消耗越少，我们就能将更多的数据缓存在本地节点，同样能提高性能。
- 在初赛以及复赛阶段，我们调研了许多不同类型的索引实现，把重点主要放在了两类索引上：哈希索引和前缀树索引
- 初赛采用了简单哈希

# 复赛 

复赛增加了对数据进行加密的需求。在云计算时代，数据的安全性至关重要，要求内存中的 Value 处于加密状态，满足云数据库安全方面的需求。其次，复赛需要实现 Delete 接口。模拟共享内存池按需使用回收的效果。第三，复赛增加了对变长 Value 的支持。复赛的 Value 大小为 80-1024 字节，并且会有 Value 的变长更新。

## 架构修改 

第一部分是数据加密上的修改。在数据加密的实现上我们依托于 “Intel Ice Lake 第三代可拓展处理器” 和 Intel IPP-Crypto 库，很快的实现了数据加密功能，并且获得了非常强的加解密性能。而在架构上，我们将加密模块放在最上层，使数据更加安全。

在删除数据的实现上，我们采用的是==类似 mysql optimize table 的方式， 也就是在进行删除 K/V 操作时，并不会直接将数据从远程内存池中删除，而是为数据打上删除标记。==而后，我们在远程内存管理模块加入了 optimize table 的触发机制，当远程内存的使用达到一定比例时，触发 optimize table 动作，对数据进行实际删除。

## 多线程异步设计 

![多线程](/img/competition/2022-Fourth-Global-Database-Competition-Track-1/assets/多线程.webp)

异步将数据写到远程内存： 

- 主线程从 Buffer 池中获取一块 Buffer 用于写数据
- 当前 Buffer 写满后，将写 Buffer 到内存池的任务加入任务队列，然后从 Buffer 池中获取一块新 Buffer
- Write Buffer 任务将被线程池中的工作线程执行，调用 RDMA Write 将 Buffer 数据写入远端
- 完成后工作线程将 Buffer 清空，并放回 Buffer 池中

## 索引优化

在索引的设计上，我们借鉴了 Google 的 Faster 这篇论文提出的 Hash 索引结构，结合我们实际的理解和需求进行了改进。

我们设计了这样一个Hash 索引结构，其有两个特点： 

- Cache友好--64 字节
- 无锁并发--CAS

具体结构是这样的：

![索引](/img/competition/2022-Fourth-Global-Database-Competition-Track-1/assets/索引.webp)

Hash Table 由一个个的 Bucket 组成，每个 Bucket 为 64 字节，而一个 Bucket 内部是 7 个 Entry，每个 Entry 长度为 8 字节，最后一个 Entry 用来指向下一个 Bucket。

Entry中会存放 1bit 探测位，40 bit Tag ，和 23 bit Offset。该 Offset 会指向 K/V 数组。 

### 插入过程

在插入的时候，首先将 KV 数据写入 K/V 数组，然后根据 Hash 值找到对应的 Bucket，遍历
Bucket 中的 Entry，找到未使用的Entry，将哈希值的 低 40 位写入 Tag，将 KV 数据在数组的偏移量写入 Offset。

### 查找过程

在查找的时候，根据 Hash 值定位到Bucket，遍历 Bucket 找到 Entry，然后找到 K/V 数据。

## 数据压缩

- 游程编码
- 通用压缩

## 读写热点

针对读，设计了 KV Cache。针对写，设计了 Write Cache。

# 最终架构

![架构](/img/competition/2022-Fourth-Global-Database-Competition-Track-1/assets/架构.webp)

> PS：第一名
