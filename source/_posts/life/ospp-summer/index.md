---
title: "开源之夏2023—从0到1的夏天"
date: "2024-05-15"
updated: "2024-05-15"
update_time: true
cover: /img/life/ospp-summer/featured.jpeg
thumbnail: /img/life/ospp-summer/featured.jpeg
tags: 
 - 随笔
 - 开源之夏
 - Kubernetes
 - Serverless
 - OpenFunction
categories: life
toc: true
---

在研一刚刚结束的暑假，我参加了开源之夏，非常荣幸分享一下本次参加开源之夏的感受和收获。在实验室师兄和同学的推荐下，我了解到了开源之夏（OSPP）这项活动。通过浏览官网和项目，我产生了浓厚的兴趣，希望能够参与其中。

<article class="message is-info">
  <div class="message-header">
    <p><i class="fas fa-image"></i> &nbsp; 关于头图</p>
  </div>
  <div class="message-body">
    头图来自 <a href="https://unsplash.com/photos/round-white-led-light-ZPP-zP8HYG0" target="_blank">Unsplash</a>。
  </div>
</article>

<!-- more -->

> 开源之夏是由中科院软件所“开源软件供应链点亮计划”发起并长期支持的一项暑期开源活动，旨在鼓励在校学生积极参与开源软件的开发维护，培养和发掘更多优秀的开发者，促进优秀开源软件社区的蓬勃发展，助力开源软件供应链建设。

两年前, KubeSphere 社区和尚硅谷联合推出了《云原生实践》课程<sup>[ 1 ]</sup>，也就是那时候我接触到了 KubeSphere 社区。KubeSphere 是青云科技开源的项目，此外 KubeSphere 团队也推出了很多优秀的开源项目，比如 FaaS 框架 OpenFunction。同时对 Serverless 研究方向 拥有极大的兴趣，所以决定报名 KubeSphere 社区在本次开源之夏活动中提交的 OpenFunction 项目。最后十分荣幸，被导师选中。

> 2019 年，伯克利以新的视角发布了一篇文献：将云中的编程变得简单：伯克利视角下的 Serverless 计算<sup>[ 2 ]</sup>，观点让人眼前一亮：
>
> Serverless 所提供的接口，简化了云计算的编程，其代表了程序员生产力的又一次的变革，一如编程语言从汇编时代演变为高级语言时代。
>
> 因为 Serverless 和传统的云计算有着本质的区别：
>
> - 计算和存储的解耦，彼此独立扩展和定价。
> - 将执行的代码作为运行的对象，而屏弃了分配该段代码所运行的资源。
> - 代码成为明码标价的对象，而不再是运行代码所需要的资源。
> - OpenFunction <sup>[ 3 ]</sup> 是开源的 FaaS 平台，开发者使用 OpenFunction，可以专注于业务逻辑，而无需维护底层运行时环境和基础架构，以函数的形式开发与业务相关的源代码。

能够参与到 OpenFunction 的项目中去，一方面我可以为开源社区做贡献，另一方面对于我自己的研究也有很大的帮助。

# 从 0 到 1 ，该如何做
我的想法是，尽早启动，留有余地。尽可能把进度往前推进，为自己预留充裕的时间去完善代码，进行优化。

## 项目准备
我本次申请的项目是 OpenFunction 的 Node.js 函数框架支持 Dapr 状态管理<sup>[ 4 ]</sup>，项目的技术要求有`Node.js`、`Kubernetes`、`KinD`、`OpenFunction`、`Dapr`。

这些技术栈我之前接触很少，对我来说都是新的，需要不停的去学习。

我的方法是首先找到对应的文档。文档通常会有 Quick Start 部分，这样就不需要逐字研究，我一直认为语言只是工具，背后的思维逻辑是相通的。因为我们处在快速开发阶段，从零到精通是非常困难的。我之前主要接触 C++ 和 Go，在学习时我会直接把 Quick Start 中的代码复制到 IDE 中，遇到不懂的再询问 AI 工具，搜索视频讲解即可。

学习新语言要抓住共性，利用好参考资料，并在编码实践中掌握语法，尽可能多的去练习。

## 如何开发

拥抱 AI，AGC 时代已经到来，我们应该善用它。询问 AI 是解决问题的快捷途径。
与导师多沟通。在开发第一个功能即状态管理时，前期沟通不够，自己实现后发现与文档要求有偏差，于是又重新写了一版。
Debug 是最快上手项目的方法，可以清晰掌握整体运行逻辑。我不喜欢逐行阅读代码，断点调试可以快速理解项目架构。
化繁为简，在实现第二个功能即基于 KinD 的 e2e 测试时，整体流程复杂了，可以分步实现，最后完成完整的测试。

## 项目产出

目前，我已经顺利完成了项目要求中的两个功能：状态管理和基于 KinD 的端到端测试。

下面我将简要的介绍一下开发者如何在 K8s 上使用状态管理功能。

以 save 和 get 函数为例，用户只需提前在 K8s 中创建好数据库组件，并在 context 中完成数据库的定义。

```typescript
module.exports = {
  knative: {
    FUNC_CONTEXT: JSON.stringify({
      name: 'my-knative-openfunction-state-delete-context',
      version: '1.0.0',
      runtime: 'knative',
      states: {
        pg: {
          componentName: 'knative-openfunction-state-component',
          componentType: 'state.postgresql',
        },
      },
    }),
  },
};
```

在 index.msj 中的 save 和 get 函数：

```typescript
// Async function state save
async function tryKnativeAsyncStateSave(ctx, data) {
  console.log('✅ Function receive request: %o', data);
  await ctx.state.save(data);
}
// Async function state get
async function tryKnativeAsyncStateGet(ctx, data) {
  console.log('✅ Function receive request: %o', data);
  await ctx.state.get(data);
}
```

package.json 文件：

```json
{
  "main": "index.mjs",
  "scripts": {
    "save": "functions-framework --target=tryKnativeAsyncStateSave --signature=openfunction",
    "get": "functions-framework --target=tryKnativeAsyncStateGet --signature=openfunction",
  },
  "dependencies": {
    "@openfunction/functions-framework": "^0.6.1"
  }
}
```

当用户发送 http 请求时，则会调用 state 组件的动作，大大简化了 serverful 开发方式下的工作量。而且通过 Dapr，可以快速的切换存储组件。

# 参与活动的感受

通过此次参与，我感受颇多，主要有两点：

1. 在开源项目中，需要考虑后续的更新和维护需求，甚至在定义结构体等方面都要仔细思考。而在比赛中，架构设计和字段定义非常自由，只需要关注如何充分利用资源获得更高分数。

2. 需要仔细阅读开发者文档。在开发状态管理功能时，一开始没有及时和导师沟通，也没有仔细看文档，导致实现过程出现偏差，后续不得不修正，做了一些不必要的工作。

另外在开发的过程中，对我帮助比较大的还有以下工具或内容：

- 开源最佳实践<sup>[ 5 ]</sup>：这篇文章出自 Rick 老师之手，Rick 老师参与过许多开源项目，具有丰富的经验。对于初次尝试参与开源的人，在面对完善、成熟、大型的开源项目时，往往会有无从下手的感觉。《开源最佳实践》将从如何选择合适的项目、如何参与贡献等多个角度引导读者。

- k9s<sup>[ 6 ]</sup>：快速地与 Kubernetes 集群进行交互。

- termius<sup>[ 7 ]</sup>：终端连接工具，有 14 天的试用期，超过 14 天会收费，可以认证一下 GitHub 的学生包，颜值在线，跨平台，可以广播终端命令。

- nocalhost<sup>[ 8 ]</sup>：一个云原生开发工具。

# 写在最后

感谢开源之夏官方以及 KubeSphere 社区能够提供这次机会，我在此次参与中收获匪浅。

非常感谢我参与的项目的导师——海立老师的辛苦指导，海立老师非常有耐心，对我的问题都是有问必答，在整个开发过程中给予了我很大帮助。同时也感谢另一个 OpenFunction 项目 OpenFunction 函数触发器<sup>[ 9 ]</sup> 的导师方阗老师，他也时常解答我的问题，给我提供了很多帮助。

最后希望开源之夏能够越做越好，也希望越来越多的高校学生能够参与进来。

# 引用链接
[1]《云原生实践》课程: https://www.kubesphere.io/zh/learn/

[2] 将云中的编程变得简单：伯克利视角下的 Serverless 计算: https://rise.cs.berkeley.edu/blog/a-berkeley-view-on-serverless-computing/

[3] OpenFunction: https://openfunction.dev/

[4] OpenFunction 的 Node.js 函数框架支持 Dapr 状态管理: https://summer-ospp.ac.cn/org/prodetail/236690197?list=org&navpage=org

[5] 开源最佳实践: https://linuxsuren.github.io/open-source-best-practice/

[6] k9s: https://k9scli.io/

[7] termius: https://termius.com/

[8] nocalhost: https://termius.com/

[9] OpenFunction 函数触发器: https://summer-ospp.ac.cn/org/prodetail/236690243?lang=zh&list=pro