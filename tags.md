---
layout: default
body_class: prose
title: tags | ramani
description: browse ramani's controlled tag vocabulary for theme, style, industry, region, and use to discover curated web design inspiration and tools.
groups:
  - name: theme
    tags: [dark, light, colorful, monochrome]
  - name: style
    tags: [minimal, brutalist, glass, editorial, playful, cinematic]
  - name: motion
    tags: [motion, scroll-driven, cursor]
  - name: industry
    tags: [fintech, saas, agency, ecommerce, education, gov, nonprofit, farm, food, defence, dev, ai, cloud, hardware, oss, privacy]
  - name: region
    tags: [tanzania, kenya, africa, global]
  - name: use
    tags: [reference, template, tool, reading]
---

# tags

Controlled vocabulary — every link on the map uses only these tags. Pick one to filter the index.

{% for g in page.groups %}
<h3 id="{{ g.name }}">{{ g.name }}</h3>
<ul class="taglist">
  {% for t in g.tags %}
  {% assign n = site.data.links | where_exp: "l", "l.tags contains t" | size %}
  <li><a{% if n == 0 %} class="is-empty"{% endif %} href="{{ '/?tag=' | append: t | relative_url }}"><span>#{{ t }}</span><b>{{ n }}</b></a></li>
  {% endfor %}
</ul>
{% endfor %}

<p><a href="{{ '/' | relative_url }}">← back to the map</a></p>
