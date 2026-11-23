---
layout: default
body_class: prose
title: privacy
description: what ramani measures, what it stores and what it leaves alone.
---

# privacy

the short version: no cookies, no accounts, no ads, no profiles, and nothing sold to anyone.

<h3>analytics</h3>

page views and clicks on cards are measured with [goatcounter](https://www.goatcounter.com/), a small, open-source, cookie-free analytics tool. it records aggregate counts only:

- the page path, the referring page and which card was clicked
- the browser, operating system, language and screen width
- the country, derived from the request

goatcounter does not store ip addresses, full user-agent strings or any identifier that could follow you across sites, and it writes nothing to your browser. its data lives on servers in finland and germany.

<h3>the chat</h3>

messages typed into kambarage are sent to a supabase edge function, which forwards them to [deepseek](https://www.deepseek.com/) to generate a reply. ramani does not keep a transcript. the rate limiter stores the request's ip address for up to two days so one address cannot exceed the quota; it is used for nothing else. deepseek's own terms apply to the text it receives.

<h3>links</h3>

ramani links to other sites. once you follow a link, that site's privacy policy applies.

questions about any of this can go to [mwalyangashadrack@gmail.com](mailto:mwalyangashadrack@gmail.com).
