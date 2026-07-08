--
-- PostgreSQL database dump
--

\restrict q05Ty6AwvUBYXE3gdQe7z2xabfG7p6vrtrFKr8uFvHZfLrMm0O273nn1dp6LA9J

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, name, email, "passwordHash", role, department, "isActive", "createdAt", "updatedAt", "deletedAt") FROM stdin;
cmq2rzss60000r797smq1obgf	مدير النظام	admin@egyglass.com	$2a$12$qXRY8z8wBHfNIyZEtyjgF.jni2/Cq2QjiHqsxUA..txQUTkG9QOEW	ADMIN	EXECUTIVE	t	2026-06-06 19:58:23.094	2026-06-06 19:58:23.094	\N
cmq2rzssn0001r797c1rtggy7	مدير المبيعات	salesmanager@egyglass.com	$2a$12$qXRY8z8wBHfNIyZEtyjgF.jni2/Cq2QjiHqsxUA..txQUTkG9QOEW	SALES_MANAGER	SALES	t	2026-06-06 19:58:23.111	2026-06-06 19:58:23.111	\N
cmq2rzsst0002r797j43hl4tm	مندوب مبيعات	salesrep@egyglass.com	$2a$12$qXRY8z8wBHfNIyZEtyjgF.jni2/Cq2QjiHqsxUA..txQUTkG9QOEW	SALES_REP	SALES	t	2026-06-06 19:58:23.117	2026-06-06 19:58:23.117	\N
cmq2rzst40004r797i5coj08l	مشاهد	viewer@egyglass.com	$2a$12$qXRY8z8wBHfNIyZEtyjgF.jni2/Cq2QjiHqsxUA..txQUTkG9QOEW	VIEWER	SALES	f	2026-06-06 19:58:23.129	2026-06-07 21:57:27.524	2026-06-07 21:57:27.522
cmq2rzssz0003r797cmrgivyj	مدير المعاينات	inspection@egyglass.com	$2a$12$qXRY8z8wBHfNIyZEtyjgF.jni2/Cq2QjiHqsxUA..txQUTkG9QOEW	INSPECTION_MANAGER	INSPECTIONS	t	2026-06-06 19:58:23.123	2026-06-08 11:59:17.087	\N
cmqo8p2xy0000ol38i3nz6oge	mohamed	m@egyglass.com	$2a$12$n5UsXELZURl9AeZa/0XppOi3UF021eqtKSNQ/yryS3X3qPWN2qtjO	SALES_REP	SALES	t	2026-06-21 20:29:06.211	2026-06-21 20:29:06.211	\N
cmq4rlld6000dr72h5wel1wse	Batul	Batul@egyglass.com	$2a$12$DzViGJt51RE5OMbIDm/8reJKqiBg5n5TKdrUyyzhXgSgC4W2K6F9.	VIEWER	SALES	t	2026-06-08 05:22:52.65	2026-07-07 08:01:07.917	\N
cmq4buwdh0004r72hmxv2nzbl	Batul	Batul@egyglas.com	$2a$12$D0w2A0ykjThMrcjAZP6m0O5CE4kVOaPoSRNKy8tbl60ke/rkCo3Yi	VIEWER	EXECUTIVE	t	2026-06-07 22:02:12.964	2026-07-07 08:49:24.712	\N
\.


--
-- Data for Name: ActivityLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ActivityLog" (id, "userId", action, entity, "entityId", details, "createdAt") FROM stdin;
cmq4bos4s0001r72h4igcb0p7	cmq2rzss60000r797smq1obgf	USER_DELETED	User	cmq2rzst40004r797i5coj08l	{"name":"مشاهد","email":"viewer@egyglass.com"}	2026-06-07 21:57:27.532
cmq4buwdp0006r72hmgeutlty	cmq2rzss60000r797smq1obgf	USER_CREATED	User	cmq4buwdh0004r72hmxv2nzbl	{"name":"Batul","email":"Batul@egyglas.com","role":"VIEWER","department":"EXECUTIVE"}	2026-06-07 22:02:12.974
cmq4rav710008r72hfcak3l7s	cmq2rzss60000r797smq1obgf	USER_DELETED	User	cmq4buwdh0004r72hmxv2nzbl	{"name":"Batul","email":"Batul@egyglas.com"}	2026-06-08 05:14:32.173
cmq4rlldp000fr72hyw2qwulu	cmq2rzss60000r797smq1obgf	USER_CREATED	User	cmq4rlld6000dr72h5wel1wse	{"name":"Batul","email":"Batul@egyglass.com","role":"VIEWER","department":"SALES"}	2026-06-08 05:22:52.668
cmq4rlwtt000jr72hvcistq8a	cmq2rzss60000r797smq1obgf	USER_DELETED	User	cmq4rlld6000dr72h5wel1wse	{"name":"Batul","email":"Batul@egyglass.com"}	2026-06-08 05:23:07.505
cmq4wf31f0003r72h4z4lswbp	cmq2rzss60000r797smq1obgf	USER_DELETED	User	cmq2rzssz0003r797cmrgivyj	{"name":"مدير المعاينات","email":"inspection@egyglass.com"}	2026-06-08 07:37:47.043
cmq55rdkv0003qs24ety8wldy	cmq2rzss60000r797smq1obgf	USER_REACTIVATED	User	cmq2rzssz0003r797cmrgivyj	\N	2026-06-08 11:59:17.119
cmqo8p2ys0002ol389r5plz94	cmq2rzss60000r797smq1obgf	USER_CREATED	User	cmqo8p2xy0000ol38i3nz6oge	{"name":"mohamed","email":"m@egyglass.com","role":"SALES_REP","department":"SALES"}	2026-06-21 20:29:06.244
cmqoatb130001ol24a8u4b1qa	cmq2rzss60000r797smq1obgf	CUSTOMER_UPDATED	Customer	cmq2rzsu1000er797ct2dho4r	{"changes":["name","phone","altPhone","type","source","address","notes","isRepeat","ownerId"]}	2026-06-21 21:28:22.551
cmqoavq6e0003ol24mh5wk3qe	cmq2rzss60000r797smq1obgf	CUSTOMER_UPDATED	Customer	cmq2rzsu1000er797ct2dho4r	{"changes":["name","phone","altPhone","type","source","address","notes","isRepeat","ownerId"]}	2026-06-21 21:30:15.494
cmqp4awoo0001ol2zg7wu4ida	cmq2rzss60000r797smq1obgf	CUSTOMER_UPDATED	Customer	cmq2rzsu1000er797ct2dho4r	{"changes":["name","phone","altPhone","type","source","address","notes","isRepeat","ownerId"]}	2026-06-22 11:13:52.632
cmqp4eu8g0005ol2z0cp1o7r7	cmq2rzss60000r797smq1obgf	CUSTOMER_CREATED	Customer	cmqp4eu860003ol2z73daqqv0	{"name":"Ahmad","phone":"012345678910","type":"ENGINEER","source":"REFERRAL"}	2026-06-22 11:16:56.08
cmqpiaqor0001ol3p3i8d2coy	cmq2rzss60000r797smq1obgf	CUSTOMER_UPDATED	Customer	cmqp4eu860003ol2z73daqqv0	{"changes":["name","phone","altPhone","type","source","address","notes","isRepeat","ownerId"]}	2026-06-22 17:45:39.484
cmqpib0ef0003ol3pfr3i6kyh	cmq2rzss60000r797smq1obgf	CUSTOMER_UPDATED	Customer	cmqp4eu860003ol2z73daqqv0	{"changes":["name","phone","altPhone","type","source","address","notes","isRepeat","ownerId"]}	2026-06-22 17:45:52.071
cmqpieecs0007ol3pn6q5j0s6	cmq2rzss60000r797smq1obgf	CUSTOMER_CREATED	Customer	cmqpieecj0005ol3paxbe0gmo	{"name":"Youssef Hammad","phone":"66055057","type":"ENGINEER","source":"EXHIBITION"}	2026-06-22 17:48:30.124
cmqpk5i4t0003ol24yjjoqtzr	cmq2rzss60000r797smq1obgf	CUSTOMER_CREATED	Customer	cmqpk5i4j0001ol24b9norgid	{"name":"lama","phone":"66055057","type":"INDIVIDUAL","source":"VISIT"}	2026-06-22 18:37:34.349
cmqpk5ucf0005ol24c01302yy	cmq2rzss60000r797smq1obgf	CUSTOMER_UPDATED	Customer	cmqpk5i4j0001ol24b9norgid	{"changes":["name","phone","altPhone","type","source","address","notes","isRepeat","ownerId"]}	2026-06-22 18:37:50.175
cmqpksb9t0001nn24jaeracou	cmq2rzss60000r797smq1obgf	STAGE_CHANGED	Customer	cmqpk5i4j0001ol24b9norgid	{"from":"NEW","to":"FOLLOW_UP"}	2026-06-22 18:55:18.545
cmqpkvdmu0003nn243xyooipz	cmq2rzss60000r797smq1obgf	STAGE_CHANGED	Customer	cmqpk5i4j0001ol24b9norgid	{"from":"FOLLOW_UP","to":"REJECTED","rejectReason":"no"}	2026-06-22 18:57:41.574
cmqpkwf0p0005nn24td4n2fhw	cmq2rzss60000r797smq1obgf	STAGE_CHANGED	Customer	cmqpk5i4j0001ol24b9norgid	{"from":"REJECTED","to":"RE_INSPECTION_FOLLOWUP"}	2026-06-22 18:58:30.025
cmqplqwgn0001mt3ad4p9eii3	cmq2rzss60000r797smq1obgf	STAGE_CHANGED	Customer	cmqpk5i4j0001ol24b9norgid	{"from":"RE_INSPECTION_FOLLOWUP","to":"EXECUTION"}	2026-06-22 19:22:12.311
cmqplrk1l0003mt3amzwijy2y	cmq2rzss60000r797smq1obgf	STAGE_CHANGED	Customer	cmqpk5i4j0001ol24b9norgid	{"from":"EXECUTION","to":"REJECTED","rejectReason":"لاغي"}	2026-06-22 19:22:42.874
cmqpmm7kq0001qn24k5g9pvbv	cmq2rzss60000r797smq1obgf	STAGE_CHANGED	Customer	cmqpk5i4j0001ol24b9norgid	{"from":"REJECTED","to":"RE_INSPECTION_FOLLOWUP"}	2026-06-22 19:46:33.05
cmqpo3rru0003qn245xc6igf3	cmq2rzss60000r797smq1obgf	CUSTOMER_UPDATED	Customer	cmqpk5i4j0001ol24b9norgid	{"changes":["name","phone","altPhone","type","source","address","notes","isRepeat","ownerId"]}	2026-06-22 20:28:11.994
cmqpo5tri0005qn249k03aemr	cmq2rzss60000r797smq1obgf	CUSTOMER_UPDATED	Customer	cmqpk5i4j0001ol24b9norgid	{"changes":["name","phone","altPhone","type","source","address","notes","isRepeat","ownerId"]}	2026-06-22 20:29:47.887
cmqpoc5vt0007qn247k2l8u4i	cmq2rzss60000r797smq1obgf	CUSTOMER_UPDATED	Customer	cmqpk5i4j0001ol24b9norgid	{"changes":["name","phone","altPhone","type","source","address","notes","isRepeat","ownerId"]}	2026-06-22 20:34:43.529
cmqppadun0001qn24ga0t2qtg	cmq2rzss60000r797smq1obgf	COVERAGE_UPDATED	Customer	cmqpieecj0005ol3paxbe0gmo	{"from":null,"to":"cmqo8p2xy0000ol38i3nz6oge"}	2026-06-22 21:01:20.159
cmqppb3ub0003qn24gbrixpfm	cmq2rzss60000r797smq1obgf	OWNER_ASSIGNED	Customer	cmqpieecj0005ol3paxbe0gmo	{"from":null,"to":"cmq2rzssn0001r797c1rtggy7"}	2026-06-22 21:01:53.843
cmqppbe0l0005qn24gxbxv1we	cmq2rzss60000r797smq1obgf	COVERAGE_UPDATED	Customer	cmqpieecj0005ol3paxbe0gmo	{"from":"cmqo8p2xy0000ol38i3nz6oge","to":"cmqo8p2xy0000ol38i3nz6oge"}	2026-06-22 21:02:07.029
cmqppc2le0007qn24ebqvsuh1	cmq2rzss60000r797smq1obgf	COVERAGE_UPDATED	Customer	cmqpk5i4j0001ol24b9norgid	{"from":null,"to":"cmq2rzsst0002r797j43hl4tm"}	2026-06-22 21:02:38.882
cmqppy1qs0001qn240p1qe6qh	cmq2rzss60000r797smq1obgf	COVERAGE_UPDATED	Customer	cmqp4eu860003ol2z73daqqv0	{"from":null,"to":"cmqo8p2xy0000ol38i3nz6oge"}	2026-06-22 21:19:44.212
cmqppzvp30003qn24k264xuj5	cmq2rzss60000r797smq1obgf	CUSTOMER_UPDATED	Customer	cmqpieecj0005ol3paxbe0gmo	{"changes":["name","phone","altPhone","type","source","address","notes","isRepeat","ownerId"]}	2026-06-22 21:21:09.687
cmqprppwn0003lh2408gvctzb	cmq2rzss60000r797smq1obgf	INTERACTION_ADDED	Customer	cmqpieecj0005ol3paxbe0gmo	{"interactionId":"cmqprppwf0001lh24usjs4eb7","type":"VISIT"}	2026-06-22 22:09:14.855
cmqprqiy00007lh240ni3ft0m	cmq2rzss60000r797smq1obgf	INTERACTION_ADDED	Customer	cmqpieecj0005ol3paxbe0gmo	{"interactionId":"cmqprqixu0005lh246drav7uy","type":"NOTE"}	2026-06-22 22:09:52.489
cmqprr7zs000blh24e5blipd1	cmq2rzss60000r797smq1obgf	INTERACTION_ADDED	Customer	cmqpieecj0005ol3paxbe0gmo	{"interactionId":"cmqprr7zo0009lh247fw5psrs","type":"WHATSAPP"}	2026-06-22 22:10:24.953
cmqprrk5e000flh24xibxbk6l	cmq2rzss60000r797smq1obgf	INTERACTION_ADDED	Customer	cmqpieecj0005ol3paxbe0gmo	{"interactionId":"cmqprrk59000dlh24rjik6cr2","type":"CALL"}	2026-06-22 22:10:40.707
cmqprrpwk000hlh24ee64f3xx	cmq2rzss60000r797smq1obgf	COVERAGE_UPDATED	Customer	cmqpieecj0005ol3paxbe0gmo	{"from":"cmqo8p2xy0000ol38i3nz6oge","to":"cmqo8p2xy0000ol38i3nz6oge"}	2026-06-22 22:10:48.164
cmqprs5vb000jlh24qvfrb0mo	cmq2rzss60000r797smq1obgf	COVERAGE_UPDATED	Customer	cmqpk5i4j0001ol24b9norgid	{"from":"cmq2rzsst0002r797j43hl4tm","to":"cmq2rzssn0001r797c1rtggy7"}	2026-06-22 22:11:08.856
cmqpsen3k0001lt24jckn5zr1	cmq2rzss60000r797smq1obgf	COVERAGE_UPDATED	Customer	cmqpk5i4j0001ol24b9norgid	{"from":"cmq2rzssn0001r797c1rtggy7","to":"cmq2rzsst0002r797j43hl4tm"}	2026-06-22 22:28:37.616
cmqpseys90005lt249u11vjb2	cmq2rzss60000r797smq1obgf	INTERACTION_ADDED	Customer	cmqpk5i4j0001ol24b9norgid	{"interactionId":"cmqpseys10003lt24vv5clr9q","type":"VISIT"}	2026-06-22 22:28:52.761
cmqpsfdcs0007lt24484v8gly	cmq2rzss60000r797smq1obgf	COVERAGE_UPDATED	Customer	cmq2rzsu1000er797ct2dho4r	{"from":null,"to":"cmq2rzssn0001r797c1rtggy7"}	2026-06-22 22:29:11.645
cmqpsfr5z000blt24gv4to93f	cmq2rzss60000r797smq1obgf	INTERACTION_ADDED	Customer	cmq2rzsu1000er797ct2dho4r	{"interactionId":"cmqpsfr5v0009lt24l0c4k6sy","type":"VISIT"}	2026-06-22 22:29:29.544
cmqr0ywr10001p82463pjidaf	cmq2rzss60000r797smq1obgf	CUSTOMER_UPDATED	Customer	cmq2rzstv000cr797n49owud2	{"changes":["name","phone","altPhone","type","source","address","notes","isRepeat","ownerId"]}	2026-06-23 19:16:06.35
cmqr4d96t0001qn24onfqls6r	cmq2rzss60000r797smq1obgf	CUSTOMER_UPDATED	Customer	cmq2rzstv000cr797n49owud2	{"changes":["name","phone","altPhone","type","source","address","notes","isRepeat","ownerId"]}	2026-06-23 20:51:14.501
cmqr4dlzd0003qn246qyayxkq	cmq2rzss60000r797smq1obgf	COVERAGE_UPDATED	Customer	cmq2rzstv000cr797n49owud2	{"from":null,"to":"cmqo8p2xy0000ol38i3nz6oge"}	2026-06-23 20:51:31.081
cmqr4e7qb0007qn24johwk7ve	cmq2rzss60000r797smq1obgf	INTERACTION_ADDED	Customer	cmq2rzstv000cr797n49owud2	{"interactionId":"cmqr4e7pu0005qn243ckweur0","type":"VISIT"}	2026-06-23 20:51:59.267
cmqr4hy9w000bqn240ls4d3jm	cmq2rzss60000r797smq1obgf	CUSTOMER_CREATED	Customer	cmqr4hy9m0009qn24vxgqomqy	{"name":"محمود","phone":"012345678910","type":"ENGINEER","source":"REFERRAL"}	2026-06-23 20:54:53.637
cmqr7a7sg0001qh248hh7ljm7	cmq2rzss60000r797smq1obgf	STAGE_CHANGED	Customer	cmqpieecj0005ol3paxbe0gmo	{"from":"NEW","to":"INSPECTION"}	2026-06-23 22:12:51.569
cmqr7lf6v0005qh24xodyu6fj	cmq2rzss60000r797smq1obgf	INSPECTION_CREATED	InspectionRequest	cmqr7lf640003qh24zscwvogq	{"customerId":"cmqpieecj0005ol3paxbe0gmo","location":"INSIDE_CAIRO","type":"PRICING"}	2026-06-23 22:21:34.375
cmqs752yq0003qha408h9mr63	cmq2rzss60000r797smq1obgf	INSPECTION_CREATED	InspectionRequest	cmqs752y10001qha43igbby9y	{"test":"C2-inside"}	2026-06-24 14:56:38.21
cmqs752ze0007qha4ikcs3sja	cmq2rzss60000r797smq1obgf	INSPECTION_CREATED	InspectionRequest	cmqs752z50005qha4525h5wk2	{"test":"C2-outside"}	2026-06-24 14:56:38.233
cmqs84icv0003qk246mg3tzi0	cmq2rzss60000r797smq1obgf	INSPECTION_CREATED	InspectionRequest	cmqs84ick0001qk24g6lfec2m	{"customerId":"cmqpieecj0005ol3paxbe0gmo","location":"INSIDE_CAIRO","type":"PRICING"}	2026-06-24 15:24:11.119
cmqs859rl0007qk24zp2s3lai	cmq2rzss60000r797smq1obgf	INSPECTION_CREATED	InspectionRequest	cmqs859re0005qk24ng389tx0	{"customerId":"cmq2rzstv000cr797n49owud2","location":"OUTSIDE_CAIRO","type":"PRICING"}	2026-06-24 15:24:46.641
cmqsl3u3v000bqk24ewt80b66	cmq2rzss60000r797smq1obgf	INSPECTION_CREATED	InspectionRequest	cmqsl3u3f0009qk24srwiinbl	{"customerId":"cmq2rzsta0006r797tgeks44v","location":"OUTSIDE_CAIRO","type":"EXECUTION"}	2026-06-24 21:27:34.699
cmqu5vupc0001qk7kvzss4xy1	cmq2rzss60000r797smq1obgf	INSPECTION_SCHEDULED	InspectionRequest	cmqr7lf640003qh24zscwvogq	{"test":true}	2026-06-25 23:57:00.335
cmqu6nnqs0001qk24ot9gvj4f	cmq2rzss60000r797smq1obgf	INSPECTION_SCHEDULED	InspectionRequest	cmqsl3u3f0009qk24srwiinbl	{"scheduledAt":"2026-06-30T00:00:00.000Z","assigneeId":"cmq2rzsst0002r797j43hl4tm"}	2026-06-26 00:18:37.684
cmquv3adc0003qk24u1sne632	cmq2rzss60000r797smq1obgf	INSPECTION_SCHEDULED	InspectionRequest	cmq2rzsur000or797831h60hf	{"scheduledAt":"2026-07-02T00:00:00.000Z","assigneeId":"cmq2rzssn0001r797c1rtggy7"}	2026-06-26 11:42:37.632
cmr88aea70004p424yys0gspe	cmq2rzss60000r797smq1obgf	CREATE	Quotation	cmr88ae8z0001p424xf3ehxzo	تم إنشاء عرض سعر "عرض تجريبي" للعميل Ahmad برقم Q-2026-00003	2026-07-05 20:13:04.591
cmr8b9t7f0001p424bn8gmyeu	cmq2rzss60000r797smq1obgf	APPROVE	Quotation	cmq2rzsuk000kr7970j79qbec	تمت الموافقة على عرض السعر Q-2026-0002	2026-07-05 21:36:36.123
cmr8wev7d0003p425bi4oiz6r	cmq2rzss60000r797smq1obgf	CUSTOMER_CREATED	Customer	cmr8wev6q0001p425ya7gwds0	{"name":"أحمد محمد","phone":"01012345678","type":"INDIVIDUAL","source":"VISIT"}	2026-07-06 07:28:23.929
cmr9hoxsr0004p4245nfke3s9	cmq2rzss60000r797smq1obgf	CREATE	Quotation	cmr9hoxrf0001p424ge80p3io	تم إنشاء عرض سعر "Qut" للعميل Youssef Hammad برقم Q-2026-00004	2026-07-06 17:24:05.787
cmr9ig9za0003p4246rwd183d	cmq2rzss60000r797smq1obgf	CUSTOMER_CREATED	Customer	cmr9ig9yx0001p424cf91bayh	{"name":"ٌRamez","phone":"01223456789","type":"INDIVIDUAL","source":"AD"}	2026-07-06 17:45:21.286
cmr9jwsi90003p424849gbzao	cmq2rzss60000r797smq1obgf	INTERACTION_ADDED	Customer	cmr9ig9yx0001p424cf91bayh	{"interactionId":"cmr9jwshz0001p424rk60mwbn","type":"VISIT"}	2026-07-06 18:26:11.409
cmr9jx6dx0007p4242tlurye1	cmq2rzss60000r797smq1obgf	INSPECTION_CREATED	InspectionRequest	cmr9jx6dp0005p424xmygfaop	{"customerId":"cmr9ig9yx0001p424cf91bayh","location":"INSIDE_CAIRO","type":"PRICING"}	2026-07-06 18:26:29.397
cmr9l3h2e0003p424znzguph9	cmq2rzss60000r797smq1obgf	INSPECTION_CREATED	InspectionRequest	cmr9l3h1s0001p424xsoj45z2	{"customerId":"cmr9ig9yx0001p424cf91bayh","location":"OUTSIDE_CAIRO","type":"PRICING"}	2026-07-06 18:59:22.79
cmra5oh030003nd3lzy7qaohx	cmq2rzss60000r797smq1obgf	CUSTOMER_CREATED	Customer	cmra5ogzo0001nd3lpmio222n	{"name":"حسين ابراهيم","phone":"01012345100","type":"INDIVIDUAL","source":"VISIT"}	2026-07-07 04:35:34.804
cmra5s19j0007nd3lqk3vmgbw	cmq2rzss60000r797smq1obgf	INSPECTION_CREATED	InspectionRequest	cmra5s1910005nd3l97la7vqt	{"customerId":"cmra5ogzo0001nd3lpmio222n","location":"INSIDE_CAIRO","type":"PRICING"}	2026-07-07 04:38:21.031
cmra63khb000bnd3ln340aso1	cmq2rzss60000r797smq1obgf	APPROVE	Quotation	cmra_hussein_q001	تمت الموافقة على عرض السعر QUO-2026-0020	2026-07-07 04:47:19.151
cmra66u7s000hnd3lplpf0yqf	cmq2rzss60000r797smq1obgf	UPDATE_STATUS	ManufacturingOrder	cmra63khn000fnd3lpudawgov	تم تغيير حالة أمر التصنيع من PENDING إلى READY	2026-07-07 04:49:51.736
cmra687u5000nnd3lp8sy1o0x	cmq2rzss60000r797smq1obgf	CUSTOMER_CREATED	Customer	cmra687tj000lnd3lafw31fqq	{"name":"ادهم الشاذلي","phone":"01055566677","type":"INDIVIDUAL","source":"VISIT"}	2026-07-07 04:50:56.045
cmra6d8ae000snd3lubys9jrq	cmq2rzss60000r797smq1obgf	CREATE	Quotation	cmra6d89u000pnd3ll6o9fww8	تم إنشاء عرض سعر "أبواب زجاجية - مكتب المعادي" للعميل ادهم الشاذلي برقم Q-2026-00006	2026-07-07 04:54:49.91
cmra6dvpz000und3lua4wtagb	cmq2rzss60000r797smq1obgf	UPDATE_STATUS	Quotation	cmra6d89u000pnd3ll6o9fww8	تم تغيير حالة عرض السعر Q-2026-00006 من DRAFT إلى PENDING_APPROVAL	2026-07-07 04:55:20.28
cmra6e8fd000wnd3l63zgveqk	cmq2rzss60000r797smq1obgf	APPROVE	Quotation	cmra6d89u000pnd3ll6o9fww8	تمت الموافقة على عرض السعر Q-2026-00006	2026-07-07 04:55:36.745
cmra6epf00012nd3lg16zm9lm	cmq2rzss60000r797smq1obgf	UPDATE_STATUS	ManufacturingOrder	cmra6e8fn0010nd3ltn63ma20	تم تغيير حالة أمر التصنيع من PENDING إلى READY	2026-07-07 04:55:58.764
cmrad0tay0001nd3e91677a0c	cmq2rzss60000r797smq1obgf	USER_REACTIVATED	User	cmq4rlld6000dr72h5wel1wse	\N	2026-07-07 08:01:07.93
cmrad9y590003nd3er30ob0kh	cmq2rzss60000r797smq1obgf	UPDATE_STATUS	ManufacturingOrder	cmra6e8fn0010nd3ltn63ma20	تم تغيير حالة أمر التصنيع من READY إلى IN_PRODUCTION	2026-07-07 08:08:14.109
cmradbf7e0005nd3ekhz7jprg	cmq2rzss60000r797smq1obgf	APPROVE	Quotation	cmr9hoxrf0001p424ge80p3io	تمت الموافقة على عرض السعر Q-2026-00004	2026-07-07 08:09:22.874
cmrade91m000bnd3e97jnu5xf	cmq2rzss60000r797smq1obgf	APPROVE	Quotation	cmr88ae8z0001p424xf3ehxzo	تمت الموافقة على عرض السعر Q-2026-00003	2026-07-07 08:11:34.859
cmradf1rc000knd3eee3mlgfc	cmq2rzss60000r797smq1obgf	CREATE	Quotation	cmradf1r3000hnd3ez9uddtit	تم إنشاء عرض سعر "xdcf" للعميل lama برقم Q-2026-00007	2026-07-07 08:12:12.073
cmraeqwhs000pnd3e2qznnk2b	cmq2rzss60000r797smq1obgf	USER_REACTIVATED	User	cmq4buwdh0004r72hmxv2nzbl	\N	2026-07-07 08:49:24.736
cmraidxrd000rnd3ejvk3hk0k	cmq2rzss60000r797smq1obgf	TOGGLE_ACTIVE	PricingFactor	cmqve5u510000r0f66j8qkltk	تم تغيير حالة تفعيل عامل التسعير 1.5 إلى غير مفعل	2026-07-07 10:31:18.313
cmraidz56000tnd3ejuhz18nj	cmq2rzss60000r797smq1obgf	TOGGLE_ACTIVE	PricingFactor	cmqve5u510000r0f66j8qkltk	تم تغيير حالة تفعيل عامل التسعير 1.5 إلى مفعل	2026-07-07 10:31:20.106
cmranxtly000xnd3e2xwzzy7u	cmq2rzss60000r797smq1obgf	CREATE	Project	cmranxtlf000vnd3ezo9v5bwq	تم إنشاء مشروع كابينه للعميل lama	2026-07-07 13:06:44.134
cmranzwkk000znd3esbe8ik93	cmq2rzss60000r797smq1obgf	LINK_QUOTATION	Project	cmranxtlf000vnd3ezo9v5bwq	تم ربط عرض السعر Q-2026-00007 بمشروع كابينه	2026-07-07 13:08:21.284
cmrbrofov0003nd3luwc5vjh9	cmq2rzss60000r797smq1obgf	CUSTOMER_CREATED	Customer	cmrbrofo40001nd3l2tqiqs76	{"name":"أكمل محمد","phone":"01234567890","type":"INDIVIDUAL","source":"VISIT"}	2026-07-08 07:39:10.831
\.


--
-- Data for Name: Attachment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Attachment" (id, parent, "parentId", "fileName", "filePath", "mimeType", "createdAt") FROM stdin;
\.


--
-- Data for Name: CashbackTier; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CashbackTier" (id, "orderFrom", "orderTo", pct, "isActive") FROM stdin;
\.


--
-- Data for Name: ProductType; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductType" (id, "nameAr", code, "calcStrategy", "isActive", "createdAt", "updatedAt") FROM stdin;
cmqve5u5z0006r0f6dikq90u1	شاور	SHOWER	SHOWER	t	2026-06-26 20:36:29.303	2026-06-26 20:36:29.303
cmqve5u6b0007r0f6f46s6vh3	هاندريل عدل	HANDR_STRAIGHT	RECIPE_FIXED	t	2026-06-26 20:36:29.316	2026-06-26 20:36:29.316
cmqve5u6i0008r0f64wc24oz1	هاندريل مائل	HANDR_INCLINED	RECIPE_FIXED	t	2026-06-26 20:36:29.322	2026-06-26 20:36:29.322
cmqve5u6n0009r0f6js5ncbj2	تجاليد	CLADDING	RECIPE_FIXED	t	2026-06-26 20:36:29.327	2026-06-26 20:36:29.327
cmqve5u6t000ar0f631dsrzze	زجاج منطبق	LAMINATED	RECIPE_FIXED	t	2026-06-26 20:36:29.333	2026-06-26 20:36:29.333
cmqve5u6y000br0f6xz4d7qae	أسقف زجاجية	GLASS_CEILING	RECIPE_FIXED	t	2026-06-26 20:36:29.338	2026-06-26 20:36:29.338
cmqve5u74000cr0f6qsf621mz	أرضيات زجاجية	GLASS_FLOOR	RECIPE_FIXED	t	2026-06-26 20:36:29.344	2026-06-26 20:36:29.344
cmqve5u79000dr0f6exscw9hn	واجهة نمطية	FACADE_MODULAR	RECIPE_FIXED	t	2026-06-26 20:36:29.349	2026-06-26 20:36:29.349
cmqve5u7l000er0f6ejqdpmuh	واجهة سبايدر	FACADE_SPIDER	RECIPE_FIXED	t	2026-06-26 20:36:29.36	2026-06-26 20:36:29.36
\.


--
-- Data for Name: ConfigType; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ConfigType" (id, "productTypeId", "nameAr", code, "sectionMod", "anglesCount", "openCloseCount", "createdAt", "updatedAt") FROM stdin;
cmqve5uzr007rr0f6bknmhmih	cmqve5u5z0006r0f6dikq90u1	بارتشن بزوايا	PARTITION_ANGLES	0.00	7	0	2026-06-26 20:36:30.375	2026-06-26 20:36:30.375
cmqve5uzw007tr0f6wwlvf5e0	cmqve5u5z0006r0f6dikq90u1	بارتشن ب U	PARTITION_U	0.00	3	0	2026-06-26 20:36:30.38	2026-06-26 20:36:30.38
cmqve5v00007vr0f6yvt8ypqo	cmqve5u5z0006r0f6dikq90u1	باب شاور نمطى	DOOR_NORMAL	0.00	0	3	2026-06-26 20:36:30.384	2026-06-26 20:36:30.384
cmqve5v04007xr0f617knjwuw	cmqve5u5z0006r0f6dikq90u1	باب شاور كبير	DOOR_LARGE	0.00	0	4	2026-06-26 20:36:30.388	2026-06-26 20:36:30.388
cmqve5v07007zr0f6a95n6ej8	cmqve5u5z0006r0f6dikq90u1	عدل ثابتين + باب	FIXED2_DOOR	-0.70	5	3	2026-06-26 20:36:30.392	2026-06-26 20:36:30.392
cmqve5v0b0081r0f6uavqpgqs	cmqve5u5z0006r0f6dikq90u1	عدل ثابت + باب	FIXED1_DOOR	-0.70	3	3	2026-06-26 20:36:30.395	2026-06-26 20:36:30.395
cmqve5v0e0083r0f6h6bx9wrq	cmqve5u5z0006r0f6dikq90u1	ثابت و باب L Shape	FIXED1_DOOR_L	-0.70	4	3	2026-06-26 20:36:30.399	2026-06-26 20:36:30.399
cmqve5v0i0085r0f6dkqduv74	cmqve5u5z0006r0f6dikq90u1	ثابتين وباب L Shape	FIXED2_DOOR_L	-0.70	5	3	2026-06-26 20:36:30.402	2026-06-26 20:36:30.402
cmqve5v0n0087r0f6orzjgv09	cmqve5u5z0006r0f6dikq90u1	زوايا ز*ز  +  L Shape	ANGLES_L	-0.70	8	3	2026-06-26 20:36:30.408	2026-06-26 20:36:30.408
cmqve5v0r0089r0f64ujpt7mg	cmqve5u5z0006r0f6dikq90u1	زاوية 135 (3 قطع)	ANGLE135_3PC	-0.70	5	2	2026-06-26 20:36:30.411	2026-06-26 20:36:30.411
cmqve5v0u008br0f6cvvqv2lp	cmqve5u5z0006r0f6dikq90u1	زاوية 135 (4 قطع)	ANGLE135_4PC	-0.70	8	2	2026-06-26 20:36:30.415	2026-06-26 20:36:30.415
cmqve5v0x008dr0f6nt5fng0n	cmqve5u5z0006r0f6dikq90u1	زاوية 135 (5 قطع)	ANGLE135_5PC	-0.70	9	2	2026-06-26 20:36:30.418	2026-06-26 20:36:30.418
cmqve5v10008fr0f6r69pbguv	cmqve5u5z0006r0f6dikq90u1	جرار عدل	SLIDING_STRAIGHT	-0.70	0	1	2026-06-26 20:36:30.421	2026-06-26 20:36:30.421
cmqve5v14008hr0f6f00tr2u8	cmqve5u5z0006r0f6dikq90u1	جرار L	SLIDING_L	-0.70	0	1	2026-06-26 20:36:30.424	2026-06-26 20:36:30.424
\.


--
-- Data for Name: Customer; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Customer" (id, name, phone, "altPhone", type, source, address, notes, stage, "rejectReason", "isRepeat", "ownerId", "coveredById", "createdAt", "updatedAt", "deletedAt", "isVip") FROM stdin;
cmq2rzsta0006r797tgeks44v	أحمد محمد	01000000001	\N	INDIVIDUAL	AD	القاهرة الجديدة	\N	NEW	\N	f	cmq2rzsst0002r797j43hl4tm	\N	2026-06-06 19:58:23.134	2026-06-06 19:58:23.134	\N	f
cmq2rzstj0008r797igrknefl	شركة الزجاج الحديث	01000000002	01000000003	COMPANY	REFERRAL	مدينة نصر	\N	PRICED	\N	f	cmq2rzsst0002r797j43hl4tm	\N	2026-06-06 19:58:23.143	2026-06-06 19:58:23.143	\N	f
cmq2rzsto000ar797hc7gg8sg	م. خالد علي	01000000004	\N	ENGINEER	EXHIBITION	الشيخ زايد	\N	FOLLOW_UP	\N	f	cmq2rzsst0002r797j43hl4tm	\N	2026-06-06 19:58:23.148	2026-06-06 19:58:23.148	\N	f
cmqp4eu860003ol2z73daqqv0	Ahmad	012345678910	\N	ENGINEER	WHATSAPP	\N	\N	NEW	\N	f	cmq2rzssn0001r797c1rtggy7	cmqo8p2xy0000ol38i3nz6oge	2026-06-22 11:16:56.068	2026-06-22 21:19:44.204	\N	f
cmqpk5i4j0001ol24b9norgid	lama	66055057	\N	INDIVIDUAL	WHATSAPP	\N	\N	RE_INSPECTION_FOLLOWUP	لاغي	t	cmq2rzssn0001r797c1rtggy7	cmq2rzsst0002r797j43hl4tm	2026-06-22 18:37:34.339	2026-06-22 22:28:37.611	\N	f
cmq2rzsu1000er797ct2dho4r	شركة الأهرام للزجاج	01000000006	\N	COMPANY	VISIT	\N	\N	INSPECTION	\N	t	cmqo8p2xy0000ol38i3nz6oge	cmq2rzssn0001r797c1rtggy7	2026-06-06 19:58:23.161	2026-06-22 22:29:11.638	\N	f
cmq2rzstv000cr797n49owud2	محمد حسن	01000000005	\N	INDIVIDUAL	WHATSAPP	\N	\N	REJECTED	السعر مرتفع جداً	t	cmq2rzsst0002r797j43hl4tm	cmqo8p2xy0000ol38i3nz6oge	2026-06-06 19:58:23.156	2026-06-23 20:51:31.074	\N	f
cmqr4hy9m0009qn24vxgqomqy	محمود	012345678910	\N	ENGINEER	REFERRAL	\N	\N	NEW	\N	t	cmqo8p2xy0000ol38i3nz6oge	\N	2026-06-23 20:54:53.625	2026-06-23 20:54:53.625	\N	f
cmqpieecj0005ol3paxbe0gmo	Youssef Hammad	66055057	\N	ENGINEER	EXHIBITION	\N	\N	INSPECTION	\N	t	cmq2rzssn0001r797c1rtggy7	cmqo8p2xy0000ol38i3nz6oge	2026-06-22 17:48:30.115	2026-06-23 22:12:51.554	\N	f
cmr8wev6q0001p425ya7gwds0	أحمد محمد	01012345678	\N	INDIVIDUAL	VISIT	مدينة نصر - القاهرة	\N	NEW	\N	f	\N	\N	2026-07-06 07:28:23.905	2026-07-06 07:28:23.905	\N	f
cmr9ig9yx0001p424cf91bayh	ٌRamez	01223456789	\N	INDIVIDUAL	AD	\N	\N	NEW	\N	f	cmqo8p2xy0000ol38i3nz6oge	\N	2026-07-06 17:45:21.272	2026-07-06 17:45:21.272	\N	f
cmra5ogzo0001nd3lpmio222n	حسين ابراهيم	01012345100	\N	INDIVIDUAL	VISIT	\N	\N	PRICED	\N	f	\N	\N	2026-07-07 04:35:34.788	2026-07-07 04:46:48.688	\N	f
cmra687tj000lnd3lafw31fqq	ادهم الشاذلي	01055566677	\N	INDIVIDUAL	VISIT	\N	\N	NEW	\N	f	\N	\N	2026-07-07 04:50:56.007	2026-07-07 04:50:56.007	\N	f
cmrbrofo40001nd3l2tqiqs76	أكمل محمد	01234567890	\N	INDIVIDUAL	VISIT	12	\N	NEW	\N	f	cmqo8p2xy0000ol38i3nz6oge	\N	2026-07-08 07:39:10.803	2026-07-08 07:39:10.803	\N	f
\.


--
-- Data for Name: DiscountRequest; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DiscountRequest" (id, "quotationId", "requestedPct", "approvedPct", status, "requestedById", "decidedById", reason, "createdAt", "decidedAt") FROM stdin;
cmr9hoxt40005p424cigqyxn0	cmr9hoxrf0001p424ge80p3io	19.00	\N	PENDING	cmq2rzss60000r797smq1obgf	\N	خصم 19% يتجاوز الحد الأساسي (18%)	2026-07-06 17:24:05.8	\N
cmradf1rf000lnd3e5garcz7a	cmradf1r3000hnd3ez9uddtit	25.00	\N	PENDING	cmq2rzss60000r797smq1obgf	\N	خصم 25% يتجاوز الحد الأساسي (18%)	2026-07-07 08:12:12.076	\N
\.


--
-- Data for Name: Employee; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Employee" (id, "userId", "nameAr", department, "position", "hireDate", salary, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: InspectionRequest; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InspectionRequest" (id, "customerId", location, address, phone, notes, status, "scheduledAt", "dueDate", "assigneeId", "createdAt", "updatedAt", "deletedAt", type, "siteReadiness") FROM stdin;
cmq2rzsux000qr7976hn3d9fz	cmq2rzsto000ar797hc7gg8sg	OUTSIDE_CAIRO	الشيخ زايد	01000000004	\N	SCHEDULED	2026-06-07 19:58:23.192	2026-06-10 19:58:23.192	cmq2rzssz0003r797cmrgivyj	2026-06-06 19:58:23.193	2026-06-06 19:58:23.193	\N	PRICING	\N
cmq2rzsv2000sr797wkwp6uyx	cmq2rzstj0008r797igrknefl	INSIDE_CAIRO	مدينة نصر	01000000002	\N	DONE	\N	2026-06-05 19:58:23.197	cmq2rzssz0003r797cmrgivyj	2026-06-06 19:58:23.198	2026-06-06 19:58:23.198	\N	PRICING	\N
cmqs752y10001qha43igbby9y	cmq2rzsta0006r797tgeks44v	INSIDE_CAIRO	اختبار SLA داخل القاهرة	01000000001	C2 SLA test - inside	REQUESTED	\N	2026-06-27 14:56:38.183	\N	2026-06-24 14:56:38.185	2026-06-24 14:56:38.185	\N	PRICING	\N
cmqs752z50005qha4525h5wk2	cmq2rzsta0006r797tgeks44v	OUTSIDE_CAIRO	اختبار SLA خارج القاهرة	01000000002	C2 SLA test - outside	REQUESTED	\N	2026-06-29 14:56:38.222	\N	2026-06-24 14:56:38.225	2026-06-24 14:56:38.225	\N	EXECUTION	\N
cmqs84ick0001qk24g6lfec2m	cmqpieecj0005ol3paxbe0gmo	INSIDE_CAIRO	مصر الجديده	01000000006	\N	REQUESTED	\N	2026-06-27 15:24:11.105	\N	2026-06-24 15:24:11.108	2026-06-24 15:24:11.108	\N	PRICING	\N
cmqs859re0005qk24ng389tx0	cmq2rzstv000cr797n49owud2	OUTSIDE_CAIRO	مصر الجديده	01000000006	\N	REQUESTED	\N	2026-06-29 15:24:46.632	\N	2026-06-24 15:24:46.634	2026-06-24 15:24:46.634	\N	PRICING	\N
cmqr7lf640003qh24zscwvogq	cmqpieecj0005ol3paxbe0gmo	INSIDE_CAIRO	مصر الجديده	01000000006	\N	SCHEDULED	2026-06-28 00:00:00	2026-06-25 22:21:34.332	cmq2rzss60000r797smq1obgf	2026-06-23 22:21:34.334	2026-06-25 23:57:00.255	\N	PRICING	\N
cmqsl3u3f0009qk24srwiinbl	cmq2rzsta0006r797tgeks44v	OUTSIDE_CAIRO	مصر الجديده	01000000006	\N	SCHEDULED	2026-06-30 00:00:00	2026-06-29 21:27:34.678	cmq2rzsst0002r797j43hl4tm	2026-06-24 21:27:34.682	2026-06-26 00:18:37.661	\N	EXECUTION	\N
cmq2rzsur000or797831h60hf	cmq2rzsu1000er797ct2dho4r	INSIDE_CAIRO	العاشر من رمضان	01000000006	\N	SCHEDULED	2026-07-02 00:00:00	2026-06-08 19:58:23.186	cmq2rzssn0001r797c1rtggy7	2026-06-06 19:58:23.188	2026-06-26 11:42:37.607	\N	PRICING	\N
cmr9jx6dp0005p424xmygfaop	cmr9ig9yx0001p424cf91bayh	INSIDE_CAIRO	15 ج	01223456789	\N	REQUESTED	\N	2026-07-08 18:26:29.386	\N	2026-07-06 18:26:29.389	2026-07-06 18:26:29.389	\N	PRICING	\N
cmr9l3h1s0001p424xsoj45z2	cmr9ig9yx0001p424cf91bayh	OUTSIDE_CAIRO	15 ج	01223456789	\N	REQUESTED	\N	2026-07-11 18:59:22.764	\N	2026-07-06 18:59:22.768	2026-07-06 18:59:22.768	\N	PRICING	\N
cmra5s1910005nd3l97la7vqt	cmra5ogzo0001nd3lpmio222n	INSIDE_CAIRO	مدينة نصر، القاهرة	01012345100	\N	DONE	\N	2026-07-09 04:38:21.011	\N	2026-07-07 04:38:21.013	2026-07-07 04:41:21.345	\N	PRICING	\N
\.


--
-- Data for Name: Project; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Project" (id, "nameAr", "customerId", "managerId", status, "startDate", "endDate", notes, "createdAt", "updatedAt") FROM stdin;
cmranxtlf000vnd3ezo9v5bwq	كابينه	cmqpk5i4j0001ol24b9norgid	cmq2rzssz0003r797cmrgivyj	ACTIVE	2026-07-08 00:00:00	2026-07-15 00:00:00	\N	2026-07-07 13:06:44.114	2026-07-07 13:06:44.114
\.


--
-- Data for Name: Quotation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Quotation" (id, number, "customerId", "createdById", status, subtotal, "discountPct", "cashbackPct", "discountAmount", "taxPct", "taxAmount", total, "needsApproval", "approvedById", "validUntil", "createdAt", "updatedAt", "deletedAt", "previousQuotationId", "quotationType", "reviewNote", "reviewStatus", "reviewedAt", "reviewedById", "projectId") FROM stdin;
cmq2rzsu7000gr797mk2lwjqp	Q-2026-0001	cmq2rzstj0008r797igrknefl	cmq2rzsst0002r797j43hl4tm	SENT	50000.00	10.00	0.00	5000.00	14.00	6300.00	51300.00	f	\N	2026-06-09 19:58:23.164	2026-06-06 19:58:23.167	2026-06-06 19:58:23.167	\N	\N	INITIAL	\N	PENDING_REVIEW	\N	\N	\N
cmq2rzsuk000kr7970j79qbec	Q-2026-0002	cmq2rzsu1000er797ct2dho4r	cmq2rzsst0002r797j43hl4tm	PENDING_APPROVAL	120000.00	20.00	0.00	24000.00	14.00	13440.00	109440.00	t	\N	2026-06-09 19:58:23.179	2026-06-06 19:58:23.18	2026-07-05 21:36:36.11	\N	\N	INITIAL	\N	APPROVED	2026-07-05 21:36:36.109	cmq2rzss60000r797smq1obgf	\N
cmra_hussein_q001	QUO-2026-0020	cmra5ogzo0001nd3lpmio222n	cmq2rzss60000r797smq1obgf	DRAFT	15000.00	0.00	0.00	0.00	14.00	2100.00	17100.00	f	\N	2026-08-06 04:46:30.664	2026-07-07 04:46:30.664	2026-07-07 04:47:19.145	\N	\N	INITIAL	\N	APPROVED	2026-07-07 04:47:19.144	cmq2rzss60000r797smq1obgf	\N
cmra6d89u000pnd3ll6o9fww8	Q-2026-00006	cmra687tj000lnd3lafw31fqq	cmq2rzss60000r797smq1obgf	APPROVED	571334.40	0.00	0.00	0.00	14.00	79986.82	651321.22	f	\N	2026-07-10 04:54:49.885	2026-07-07 04:54:49.89	2026-07-07 04:55:36.731	\N	\N	INITIAL	\N	APPROVED	2026-07-07 04:55:36.73	cmq2rzss60000r797smq1obgf	\N
cmr9hoxrf0001p424ge80p3io	Q-2026-00004	cmqpieecj0005ol3paxbe0gmo	cmq2rzss60000r797smq1obgf	PENDING_APPROVAL	7224.21	19.00	0.00	1372.60	14.00	819.23	6670.84	t	\N	2026-07-09 17:24:05.718	2026-07-06 17:24:05.737	2026-07-07 08:09:22.859	\N	\N	INITIAL	\N	APPROVED	2026-07-07 08:09:22.858	cmq2rzss60000r797smq1obgf	\N
cmr88ae8z0001p424xf3ehxzo	Q-2026-00003	cmqp4eu860003ol2z73daqqv0	cmq2rzss60000r797smq1obgf	DRAFT	190.00	0.00	0.00	0.00	14.00	26.60	216.60	f	\N	2026-07-08 20:13:04.485	2026-07-05 20:13:04.546	2026-07-07 08:11:34.844	\N	\N	INITIAL	\N	APPROVED	2026-07-07 08:11:34.843	cmq2rzss60000r797smq1obgf	\N
cmradf1r3000hnd3ez9uddtit	Q-2026-00007	cmqpk5i4j0001ol24b9norgid	cmq2rzss60000r797smq1obgf	PENDING_APPROVAL	34757.78	25.00	0.00	8689.44	14.00	3649.57	29717.90	t	\N	2026-07-10 08:12:12.06	2026-07-07 08:12:12.063	2026-07-07 13:08:21.256	\N	\N	INITIAL	\N	PENDING_REVIEW	\N	\N	cmranxtlf000vnd3ezo9v5bwq
\.


--
-- Data for Name: ManufacturingOrder; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ManufacturingOrder" (id, "quotationId", status, "assignedTo", notes, "expectedAt", "createdAt", "updatedAt") FROM stdin;
cmra63khn000fnd3lpudawgov	cmra_hussein_q001	READY	\N	\N	\N	2026-07-07 04:47:19.163	2026-07-07 04:49:51.731
cmra6e8fn0010nd3ltn63ma20	cmra6d89u000pnd3ll6o9fww8	IN_PRODUCTION	\N	\N	\N	2026-07-07 04:55:36.755	2026-07-07 08:08:14.104
cmradbf7n0009nd3eixo53v2w	cmr9hoxrf0001p424ge80p3io	PENDING	\N	\N	\N	2026-07-07 08:09:22.883	2026-07-07 08:09:22.883
cmrade91u000fnd3eivvxsvyo	cmr88ae8z0001p424xf3ehxzo	PENDING	\N	\N	\N	2026-07-07 08:11:34.867	2026-07-07 08:11:34.867
\.


--
-- Data for Name: InstallationOrder; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InstallationOrder" (id, "manufacturingOrderId", "teamLeadId", "scheduledAt", status, notes, "createdAt", "updatedAt") FROM stdin;
cmra66u81000jnd3lmriboinj	cmra63khn000fnd3lpudawgov	\N	\N	PENDING	\N	2026-07-07 04:49:51.745	2026-07-07 04:49:51.745
cmra6epf60014nd3la29s1dur	cmra6e8fn0010nd3ltn63ma20	\N	\N	PENDING	\N	2026-07-07 04:55:58.77	2026-07-07 04:55:58.77
\.


--
-- Data for Name: Interaction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Interaction" (id, "customerId", "userId", type, note, "createdAt") FROM stdin;
cmqprppwf0001lh24usjs4eb7	cmqpieecj0005ol3paxbe0gmo	cmq2rzss60000r797smq1obgf	VISIT	مطلوب زياره	2026-06-22 22:09:14.847
cmqprqixu0005lh246drav7uy	cmqpieecj0005ol3paxbe0gmo	cmq2rzss60000r797smq1obgf	NOTE	العميل عايز خصم تاني	2026-06-22 22:09:52.483
cmqprr7zo0009lh247fw5psrs	cmqpieecj0005ol3paxbe0gmo	cmq2rzss60000r797smq1obgf	WHATSAPP	تم ارسال عرض السعر للعميل ع الواتساب	2026-06-22 22:10:24.948
cmqprrk59000dlh24rjik6cr2	cmqpieecj0005ol3paxbe0gmo	cmq2rzss60000r797smq1obgf	CALL	العميل لا يتلقي الاتصال	2026-06-22 22:10:40.701
cmqpseys10003lt24vv5clr9q	cmqpk5i4j0001ol24b9norgid	cmq2rzss60000r797smq1obgf	VISIT	mm	2026-06-22 22:28:52.753
cmqpsfr5v0009lt24l0c4k6sy	cmq2rzsu1000er797ct2dho4r	cmq2rzss60000r797smq1obgf	VISIT	تحديد	2026-06-22 22:29:29.54
cmqr4e7pu0005qn243ckweur0	cmq2rzstv000cr797n49owud2	cmq2rzss60000r797smq1obgf	VISIT	طلب زياره	2026-06-23 20:51:59.251
cmr9jwshz0001p424rk60mwbn	cmr9ig9yx0001p424cf91bayh	cmq2rzss60000r797smq1obgf	VISIT	العميل طلب زياره و تم تحويلها الي قسم المعاينات	2026-07-06 18:26:11.399
\.


--
-- Data for Name: LeaveRequest; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LeaveRequest" (id, "employeeId", type, "startDate", "endDate", status, notes, "createdAt") FROM stdin;
\.


--
-- Data for Name: ManualItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ManualItem" (id, code, "nameAr", cost, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Material; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Material" (id, code, "nameAr", category, cost, unit, "isActive", "createdAt", "updatedAt") FROM stdin;
cmqve5u84000fr0f62t4z99fg	GL-SH-8MM-CLEAR	8 مم شفاف	GLASS	1165.00	SQM	t	2026-06-26 20:36:29.379	2026-06-26 20:36:29.379
cmqve5u8h000gr0f6z2bwn7qu	GL-SH-10MM-CLEAR	10 مم شفاف	GLASS	1315.00	SQM	t	2026-06-26 20:36:29.393	2026-06-26 20:36:29.393
cmqve5u8n000hr0f6x8od2djv	GL-SH-12MM-CLEAR	12 مم شفاف	GLASS	1686.00	SQM	t	2026-06-26 20:36:29.399	2026-06-26 20:36:29.399
cmqve5u8t000ir0f6h7ojja81	GL-SH-8MM-CRYSTAL	8 مم كريستال	GLASS	0.00	SQM	f	2026-06-26 20:36:29.405	2026-06-26 20:36:29.405
cmqve5u8x000jr0f6z6wbq64p	GL-SH-10MM-CRYSTAL	10 مم كريستال	GLASS	3021.00	SQM	t	2026-06-26 20:36:29.409	2026-06-26 20:36:29.409
cmqve5u91000kr0f67ckuao17	GL-SH-10MM-COLORED	10مم ملون رمادى / برونز / ازرق	GLASS	2120.00	SQM	t	2026-06-26 20:36:29.413	2026-06-26 20:36:29.413
cmqve5u96000lr0f6loujykta	GL-SH-10MM-BOMB	10مم شفاف بومبيه	GLASS	0.00	SQM	f	2026-06-26 20:36:29.418	2026-06-26 20:36:29.418
cmqve5u99000mr0f6itvqhcs4	GL-SH-12MM-BOMB	12مم شفاف بومبيه	GLASS	0.00	SQM	f	2026-06-26 20:36:29.422	2026-06-26 20:36:29.422
cmqve5u9d000nr0f6u9it5hob	GL-SH-TR-55-NH	تربلكس بدون تخريم 5 / 5	GLASS	1966.00	SQM	t	2026-06-26 20:36:29.425	2026-06-26 20:36:29.425
cmqve5u9h000or0f6c28fvkvt	GL-SH-TR-55-H	تربلكس بتخريم 5 / 5	GLASS	2362.00	SQM	t	2026-06-26 20:36:29.429	2026-06-26 20:36:29.429
cmqve5u9l000pr0f6j2ejgjwr	GL-SH-TR-66-NH	تربلكس بدون تخريم 6 / 6	GLASS	2256.00	SQM	t	2026-06-26 20:36:29.433	2026-06-26 20:36:29.433
cmqve5u9p000qr0f61vikinpa	GL-SH-TR-66-H	تربلكس بتخريم 6 / 6	GLASS	2652.00	SQM	t	2026-06-26 20:36:29.437	2026-06-26 20:36:29.437
cmqve5u9s000rr0f6lzecpard	GL-SH-TR-66-C-NH	تربلكس بدون تخريم 6 / 6 كريستال	GLASS	5034.00	SQM	t	2026-06-26 20:36:29.441	2026-06-26 20:36:29.441
cmqve5u9w000sr0f6s8llhh7z	GL-SH-TR-66-C-H	تربلكس بتخريم 6 / 6 كريستال	GLASS	5430.00	SQM	t	2026-06-26 20:36:29.444	2026-06-26 20:36:29.444
cmqve5ua2000tr0f695utgjnj	GL-SH-TR-55-BOMB	تربلكس بومبية 5مم / 5مم	GLASS	0.00	SQM	f	2026-06-26 20:36:29.451	2026-06-26 20:36:29.451
cmqve5ua7000ur0f6ncx3wqvt	GL-SH-TR-66-BOMB	تربلكس بومبية 6مم / 6مم	GLASS	0.00	SQM	f	2026-06-26 20:36:29.455	2026-06-26 20:36:29.455
cmqve5uab000vr0f660dbrr35	GL-SH-TR-66-G-NH	تربلكس 6/6 رمادى او برونز بدون تخريم	GLASS	0.00	SQM	f	2026-06-26 20:36:29.459	2026-06-26 20:36:29.459
cmqve5uaf000wr0f6vmr6e4gv	GL-SH-TR-66-G-H	تربلكس 6/6 رمادى او برونز بتخريم	GLASS	0.00	SQM	f	2026-06-26 20:36:29.463	2026-06-26 20:36:29.463
cmqve5uaj000xr0f6n9ug50im	GL-FC-10MM-CLEAR	10 مم شفاف	GLASS	1090.00	SQM	t	2026-06-26 20:36:29.467	2026-06-26 20:36:29.467
cmqve5uan000yr0f6oy2f0zd7	GL-FC-10MM-JUMBO	10 مم شفاف جامبو	GLASS	0.00	SQM	f	2026-06-26 20:36:29.471	2026-06-26 20:36:29.471
cmqve5uar000zr0f6y6tbiyqx	GL-FC-12MM-CLEAR	12 مم شفاف	GLASS	0.00	SQM	f	2026-06-26 20:36:29.476	2026-06-26 20:36:29.476
cmqve5uaw0010r0f6u4a91t76	GL-FC-12MM-JUMBO	12 مم شفاف جامبو	GLASS	0.00	SQM	f	2026-06-26 20:36:29.48	2026-06-26 20:36:29.48
cmqve5ub00011r0f6xeo051z4	GL-FC-10MM-COLORED	10مم ملون رمادى / برونز / ازرق	GLASS	0.00	SQM	f	2026-06-26 20:36:29.484	2026-06-26 20:36:29.484
cmqve5ub40012r0f669nyq3tz	GL-FC-10MM-CRYSTAL	10 مم كريستال	GLASS	0.00	SQM	f	2026-06-26 20:36:29.488	2026-06-26 20:36:29.488
cmqve5ub80013r0f6meho151v	GL-FC-10MM-BOMB	10مم بومبيه	GLASS	0.00	SQM	f	2026-06-26 20:36:29.492	2026-06-26 20:36:29.492
cmqve5ubc0014r0f67gm7s94i	GL-FC-10MM-BOMB-RAW	10مم بومبيه خام	GLASS	0.00	SQM	f	2026-06-26 20:36:29.496	2026-06-26 20:36:29.496
cmqve5ubg0015r0f6tllohwpo	GL-FC-12MM-BOMB	12مم بومبيه	GLASS	0.00	SQM	f	2026-06-26 20:36:29.501	2026-06-26 20:36:29.501
cmqve5ubl0016r0f6nlfvhpdt	GL-FC-TR-55-NH	تربلكس بدون تخريم 5 / 5	GLASS	0.00	SQM	f	2026-06-26 20:36:29.505	2026-06-26 20:36:29.505
cmqve5ubq0017r0f6cubbkgks	GL-FC-TR-55-H	تربلكس بتخريم 5 / 5	GLASS	0.00	SQM	f	2026-06-26 20:36:29.51	2026-06-26 20:36:29.51
cmqve5ubv0018r0f60qqgtb4m	GL-FC-TR-66-NH	تربلكس بدون تخريم 6 / 6	GLASS	0.00	SQM	f	2026-06-26 20:36:29.515	2026-06-26 20:36:29.515
cmqve5uc00019r0f6h41n7mxe	GL-FC-TR-66-H	تربلكس بتخريم 6 / 6	GLASS	0.00	SQM	f	2026-06-26 20:36:29.521	2026-06-26 20:36:29.521
cmqve5uc4001ar0f6l4rdppyo	GL-FC-TR-6BR-R-NH	تربلكس بدون تخريم 6 عاكس برونز / 6 شفاف	GLASS	0.00	SQM	f	2026-06-26 20:36:29.525	2026-06-26 20:36:29.525
cmqve5uc8001br0f6c4l42s87	GL-FC-TR-6BR-R-H	تربلكس بتخريم 6 عاكس برونز / 6 شفاف	GLASS	0.00	SQM	f	2026-06-26 20:36:29.528	2026-06-26 20:36:29.528
cmqve5ucc001cr0f6avet2c27	GL-FC-TR-6BR-B-R	تربلكس بومبية  6 عاكس برونز / 6 شفاف	GLASS	0.00	SQM	f	2026-06-26 20:36:29.532	2026-06-26 20:36:29.532
cmqve5ucf001dr0f6mzloymfp	GL-FC-TR-6G-R-NH	تربلكس بدون تخريم 6 عاكس رمادى / 6 شفاف	GLASS	0.00	SQM	f	2026-06-26 20:36:29.535	2026-06-26 20:36:29.535
cmqve5ucj001er0f6xrqdgf8y	GL-FC-TR-6G-R-H	تربلكس بتخريم 6 عاكس رمادى / 6 شفاف	GLASS	0.00	SQM	f	2026-06-26 20:36:29.539	2026-06-26 20:36:29.539
cmqve5ucn001fr0f6wegmkys2	GL-FC-TR-6G-B-R	تربلكس بومبية  6 عاكس رمادى / 6 شفاف	GLASS	0.00	SQM	f	2026-06-26 20:36:29.543	2026-06-26 20:36:29.543
cmqve5ucq001gr0f6dz5h4dtf	GL-FC-TR-55-BOMB	تربلكس بومبية 5مم / 5مم	GLASS	0.00	SQM	f	2026-06-26 20:36:29.547	2026-06-26 20:36:29.547
cmqve5ucu001hr0f6ykjkw65k	GL-FC-TR-66-BOMB	تربلكس بومبية 6مم / 6مم	GLASS	0.00	SQM	f	2026-06-26 20:36:29.55	2026-06-26 20:36:29.55
cmqve5ucy001ir0f6tglrtcs9	GL-FC-TR-66-G-NH	تربلكس 6/6 رمادى او برونز بدون تخريم	GLASS	0.00	SQM	f	2026-06-26 20:36:29.555	2026-06-26 20:36:29.555
cmqve5ud2001jr0f66qgj82vf	GL-FC-TR-66-G-H	تربلكس 6/6 رمادى او برونز بتخريم	GLASS	0.00	SQM	f	2026-06-26 20:36:29.559	2026-06-26 20:36:29.559
cmqve5ud6001kr0f6iou4gm3o	GL-SP-10MM-CLEAR	10 مم شفاف	GLASS	1090.00	SQM	t	2026-06-26 20:36:29.562	2026-06-26 20:36:29.562
cmqve5ud9001lr0f6evoppyq6	GL-SP-12MM-CLEAR	12 مم شفاف	GLASS	0.00	SQM	f	2026-06-26 20:36:29.565	2026-06-26 20:36:29.565
cmqve5udd001mr0f638xsu4dt	GL-SP-10MM-COLORED	10مم ملون رمادى / برونز / ازرق	GLASS	0.00	SQM	f	2026-06-26 20:36:29.569	2026-06-26 20:36:29.569
cmqve5udh001nr0f62z548gi4	GL-SP-TR-66-H-HOLE	تربلكس بتخريم 6 / 6	GLASS	0.00	SQM	f	2026-06-26 20:36:29.573	2026-06-26 20:36:29.573
cmqve5udk001or0f6i40iqk95	GL-SP-TR-BR-H-6B6	تربلكس بتخريم 6 عاكس برونز / 6 شفاف	GLASS	0.00	SQM	f	2026-06-26 20:36:29.576	2026-06-26 20:36:29.576
cmqve5udn001pr0f6vxwp143l	GL-SP-TR-GR-H-6R6	تربلكس بتخريم 6 عاكس رمادى / 6 شفاف	GLASS	0.00	SQM	f	2026-06-26 20:36:29.58	2026-06-26 20:36:29.58
cmqve5uds001qr0f660urtsr2	GL-SP-TR-10MM-BOMB	10مم بومبيه	GLASS	0.00	SQM	f	2026-06-26 20:36:29.584	2026-06-26 20:36:29.584
cmqve5udy001rr0f6mybhfmgu	GL-SP-TR-12MM-BOMB	12مم بومبيه	GLASS	0.00	SQM	f	2026-06-26 20:36:29.59	2026-06-26 20:36:29.59
cmqve5ue3001sr0f6pc51aine	GL-SP-TR-BOMB-6B-6R	تربلكس بومبية  6 عاكس برونز / 6 شفاف	GLASS	0.00	SQM	f	2026-06-26 20:36:29.596	2026-06-26 20:36:29.596
cmqve5ue8001tr0f6ohvlg1fs	GL-SP-TR-BOMB-6G-6R	تربلكس بومبية  6 عاكس رمادى / 6 شفاف	GLASS	0.00	SQM	f	2026-06-26 20:36:29.6	2026-06-26 20:36:29.6
cmqve5uec001ur0f6fw54z3tc	GL-SP-TR-BOMB-66	تربلكس بومبية 6مم / 6مم	GLASS	0.00	SQM	f	2026-06-26 20:36:29.605	2026-06-26 20:36:29.605
cmqve5ueg001vr0f62jdq88li	GL-SP-TR-BOMB-66-G-H	تربلكس بومبية 6/6 رمادى او برونز بتخريم	GLASS	0.00	SQM	f	2026-06-26 20:36:29.609	2026-06-26 20:36:29.609
cmqve5uek001wr0f6vwgsmsg4	GL-SP-WEAPON-GLASS	زجاج الاسلحة	GLASS	3780.00	SQM	t	2026-06-26 20:36:29.612	2026-06-26 20:36:29.612
cmqve5uen001xr0f6w1s2oxmc	GL-SP-TR-ASLH-1010	تربلكس أسلحة 10 / 10	GLASS	3930.00	SQM	t	2026-06-26 20:36:29.615	2026-06-26 20:36:29.615
cmqve5uer001yr0f6fj44u0s7	GL-SP-TR-ASLH-1212	تربلكس أسلحة 12 / 12	GLASS	4972.00	SQM	t	2026-06-26 20:36:29.619	2026-06-26 20:36:29.619
cmqve5uev001zr0f61otadxyb	GL-SP-TR-ASLH-1010-J	تربلكس أسلحة 10 / 10 جامبو	GLASS	4590.00	SQM	t	2026-06-26 20:36:29.623	2026-06-26 20:36:29.623
cmqve5uey0020r0f6ef2lcu55	GL-SP-TR-ASLH-1212-J	تربلكس أسلحة 12 / 12 جامبو	GLASS	5372.00	SQM	t	2026-06-26 20:36:29.627	2026-06-26 20:36:29.627
cmqve5uf10021r0f6ony8yiua	GL-HR-10MM-CLEAR	10 مم شفاف	GLASS	1010.00	SQM	t	2026-06-26 20:36:29.63	2026-06-26 20:36:29.63
cmqve5uf50022r0f6y73bj6qo	GL-HR-12MM-CLEAR	12 مم شفاف	GLASS	0.00	SQM	f	2026-06-26 20:36:29.634	2026-06-26 20:36:29.634
cmqve5ufa0023r0f699jg7ucf	GL-HR-15MM-CLEAR	15 مم شفاف	GLASS	0.00	SQM	f	2026-06-26 20:36:29.638	2026-06-26 20:36:29.638
cmqve5ufe0024r0f65c55vyo0	GL-HR-20MM-CLEAR	20 مم شفاف	GLASS	4026.00	SQM	t	2026-06-26 20:36:29.642	2026-06-26 20:36:29.642
cmqve5ufi0025r0f6zvsuq308	GL-HR-10MM-CRYSTAL	10 مم كريستال	GLASS	0.00	SQM	f	2026-06-26 20:36:29.646	2026-06-26 20:36:29.646
cmqve5ufl0026r0f63j7ax64n	GL-HR-15MM-CRYSTAL	15 مم كريستال	GLASS	0.00	SQM	f	2026-06-26 20:36:29.65	2026-06-26 20:36:29.65
cmqve5ufq0027r0f62nq620k0	GL-HR-20MM-CRYSTAL	20 مم كريستال	GLASS	6384.00	SQM	t	2026-06-26 20:36:29.654	2026-06-26 20:36:29.654
cmqve5uft0028r0f6igybsltq	GL-HR-10MM-COLORED	10مم ملون رمادى / برونز / ازرق	GLASS	0.00	SQM	f	2026-06-26 20:36:29.658	2026-06-26 20:36:29.658
cmqve5ufx0029r0f60yy64pdw	GL-HR-TR-66-NH	تربلكس بدون تخريم 6 / 6	GLASS	0.00	SQM	f	2026-06-26 20:36:29.661	2026-06-26 20:36:29.661
cmqve5ug0002ar0f6cypfdzp4	GL-HR-TR-66-H	تربلكس بتخريم 6 / 6	GLASS	0.00	SQM	f	2026-06-26 20:36:29.664	2026-06-26 20:36:29.664
cmqve5ug3002br0f62a0pzijk	GL-HR-TR-88-NH	تربلكس بدون تخريم 8 / 8	GLASS	2868.00	SQM	t	2026-06-26 20:36:29.668	2026-06-26 20:36:29.668
cmqve5ug7002cr0f688a7nryq	GL-HR-TR-88-H	تربلكس بتخريم 8 /8	GLASS	3264.00	SQM	t	2026-06-26 20:36:29.671	2026-06-26 20:36:29.671
cmqve5uga002dr0f63wbeklh6	GL-HR-TR-1010-NH	تربلكس بدون تخريم 10 / 10	GLASS	3146.00	SQM	t	2026-06-26 20:36:29.675	2026-06-26 20:36:29.675
cmqve5ugd002er0f6xtl9mnj1	GL-HR-TR-1010-H	تربلكس بتخريم 10 / 10	GLASS	3542.00	SQM	t	2026-06-26 20:36:29.678	2026-06-26 20:36:29.678
cmqve5ugi002fr0f6g36cxkv6	GL-HR-TR-66-C-NH	تربلكس بدون تخريم 6 / 6 كريستال	GLASS	5034.00	SQM	t	2026-06-26 20:36:29.682	2026-06-26 20:36:29.682
cmqve5ugl002gr0f6tayzeh6l	GL-HR-TR-66-C-H	تربلكس بتخريم 6 / 6 كريستال	GLASS	5430.00	SQM	t	2026-06-26 20:36:29.686	2026-06-26 20:36:29.686
cmqve5ugp002hr0f6kthmwuyv	GL-HR-TR-1010-C-NH	تربلكس بدون تخريم 10 / 10 كريستال	GLASS	6858.00	SQM	t	2026-06-26 20:36:29.689	2026-06-26 20:36:29.689
cmqve5ugt002ir0f6g4ffe0d1	GL-HR-TR-1010-C-H	تربلكس بتخريم 10 / 10 كريستال	GLASS	7254.00	SQM	t	2026-06-26 20:36:29.693	2026-06-26 20:36:29.693
cmqve5ugw002jr0f62nmnlsie	GL-HR-10MM-BOMB	10مم بومبيه	GLASS	0.00	SQM	f	2026-06-26 20:36:29.697	2026-06-26 20:36:29.697
cmqve5ugz002kr0f6ekecvf0d	GL-HR-12MM-BOMB	12مم بومبيه	GLASS	0.00	SQM	f	2026-06-26 20:36:29.7	2026-06-26 20:36:29.7
cmqve5uh3002lr0f6ob0lykhv	GL-HR-15MM-BOMB	15مم بومبيه	GLASS	0.00	SQM	f	2026-06-26 20:36:29.704	2026-06-26 20:36:29.704
cmqve5uh7002mr0f658vhhtk5	GL-HR-20MM-BOMB	20مم بومبيه	GLASS	0.00	SQM	f	2026-06-26 20:36:29.707	2026-06-26 20:36:29.707
cmqve5uhb002nr0f67dvncqxb	GL-RC-6MM-CLEAR	6 مم  شفاف	GLASS	720.00	SQM	t	2026-06-26 20:36:29.711	2026-06-26 20:36:29.711
cmqve5uhf002or0f6va1i2hjn	GL-RC-6MM-CRYSTAL	6 مم كريستال	GLASS	2109.00	SQM	t	2026-06-26 20:36:29.715	2026-06-26 20:36:29.715
cmqve5uhj002pr0f64or2xlx1	GL-RC-6MM-JUMBO	6 مم شفاف جامبو	GLASS	842.00	SQM	t	2026-06-26 20:36:29.719	2026-06-26 20:36:29.719
cmqve5uhn002qr0f63mk5cxec	GL-RC-6MM-COLORED	6مم برونز / ازرق	GLASS	0.00	SQM	f	2026-06-26 20:36:29.723	2026-06-26 20:36:29.723
cmqve5uhq002rr0f60qf6per9	GL-RC-6MM-GRAY	6مم رمادى	GLASS	0.00	SQM	f	2026-06-26 20:36:29.727	2026-06-26 20:36:29.727
cmqve5uhu002sr0f67sysfdpr	GL-RC-6MM-BOMB	6مم بومبيه	GLASS	0.00	SQM	f	2026-06-26 20:36:29.73	2026-06-26 20:36:29.73
cmqve5uhx002tr0f6zt8ujxmj	MR-6MM-WHITE	6مم مرايا ابيض	GLASS	958.00	SQM	t	2026-06-26 20:36:29.733	2026-06-26 20:36:29.733
cmqve5ui0002ur0f6excdjmnw	MR-6MM-BRONZE	6مم مرايا برونز	GLASS	1408.00	SQM	t	2026-06-26 20:36:29.737	2026-06-26 20:36:29.737
cmqve5ui4002vr0f6qabal3oj	MR-6MM-GRAY	6مم مرايا رمادى	GLASS	0.00	SQM	f	2026-06-26 20:36:29.74	2026-06-26 20:36:29.74
cmqve5ui7002wr0f6n8glplnk	MR-6MM-BLUE	6مم مرايا ازرق	GLASS	0.00	SQM	f	2026-06-26 20:36:29.743	2026-06-26 20:36:29.743
cmqve5uia002xr0f62h53assd	MR-6MM-GREEN	6مم مرايا أخضر	GLASS	0.00	SQM	f	2026-06-26 20:36:29.747	2026-06-26 20:36:29.747
cmqve5uie002yr0f6qmwfxqxa	MR-6MM-ANTQ-A	6مم مرايا انتيك class A	GLASS	0.00	SQM	f	2026-06-26 20:36:29.75	2026-06-26 20:36:29.75
cmqve5uih002zr0f6n5eumyre	MR-6MM-ANTQ-B	6مم مرايا انتيك class B	GLASS	0.00	SQM	f	2026-06-26 20:36:29.753	2026-06-26 20:36:29.753
cmqve5uil0030r0f62odxbqio	GL-RW-6MM-CLEAR	6مم شفاف خام	GLASS	0.00	SQM	f	2026-06-26 20:36:29.757	2026-06-26 20:36:29.757
cmqve5uiq0031r0f6zvszg654	GL-RW-10MM-CLEAR	10مم شفاف خام	GLASS	0.00	SQM	f	2026-06-26 20:36:29.763	2026-06-26 20:36:29.763
cmqve5uiu0032r0f6necuarz8	GL-RW-12MM-CLEAR	12مم شفاف خام	GLASS	0.00	SQM	f	2026-06-26 20:36:29.766	2026-06-26 20:36:29.766
cmqve5uix0033r0f6a645cvv7	GL-RW-6MM-GRAY	6مم رمادى خام	GLASS	0.00	SQM	f	2026-06-26 20:36:29.769	2026-06-26 20:36:29.769
cmqve5uj40034r0f678qk3v3t	GL-RW-6MM-COLORED	6مم برونز / ازرق خام	GLASS	0.00	SQM	f	2026-06-26 20:36:29.776	2026-06-26 20:36:29.776
cmqve5uj80035r0f6ubotvvyi	GL-RW-10MM-COLORED	10مم خام ملون ازرق / رمادى / برونز	GLASS	0.00	SQM	f	2026-06-26 20:36:29.781	2026-06-26 20:36:29.781
cmqve5ujc0036r0f6830l0ggm	GL-FC-10MM-CLEAR-2	10 مم شفاف (واجهة نمطية)	GLASS	1090.00	SQM	t	2026-06-26 20:36:29.785	2026-06-26 20:36:29.785
cmqve5ujg0037r0f605pl3jvi	GL-SP-10MM-CLEAR-2	10 مم شفاف (واجهة سبايدر)	GLASS	1090.00	SQM	t	2026-06-26 20:36:29.788	2026-06-26 20:36:29.788
cmqve5ujk0038r0f6riqdqows	GL-PL-4MM-CLEAR	4 مم شفاف	GLASS	446.00	SQM	t	2026-06-26 20:36:29.792	2026-06-26 20:36:29.792
cmqve5ujn0039r0f66c2gvcit	GL-PL-5MM-CLEAR	5 مم شفاف	GLASS	575.00	SQM	t	2026-06-26 20:36:29.795	2026-06-26 20:36:29.795
cmqve5ujq003ar0f6fzqfxkhd	GL-PL-6MM-CLEAR	6 مم شفاف	GLASS	720.00	SQM	t	2026-06-26 20:36:29.798	2026-06-26 20:36:29.798
cmqve5ujt003br0f618v900js	GL-PL-6MM-JUMBO	6 مم شفاف جامبو	GLASS	842.00	SQM	t	2026-06-26 20:36:29.801	2026-06-26 20:36:29.801
cmqve5ujx003cr0f6p6vn42rw	GL-PL-8MM-CLEAR	8 مم شفاف	GLASS	1026.00	SQM	t	2026-06-26 20:36:29.806	2026-06-26 20:36:29.806
cmqve5uk1003dr0f6prazo40e	GL-PL-10MM-CLEAR	10 مم شفاف	GLASS	1165.00	SQM	t	2026-06-26 20:36:29.809	2026-06-26 20:36:29.809
cmqve5uk4003er0f63htuinkw	GL-PL-10MM-JUMBO	10 مم شفاف جامبو	GLASS	1495.00	SQM	t	2026-06-26 20:36:29.812	2026-06-26 20:36:29.812
cmqve5uk7003fr0f6a98gn0i7	GL-PL-12MM-CLEAR	12 مم شفاف	GLASS	1686.00	SQM	t	2026-06-26 20:36:29.815	2026-06-26 20:36:29.815
cmqve5uka003gr0f6rn2yig9f	GL-PL-12MM-JUMBO	12 مم شفاف جامبو	GLASS	1886.00	SQM	t	2026-06-26 20:36:29.818	2026-06-26 20:36:29.818
cmqve5uke003hr0f6iv08atbg	GL-PL-15MM-CLEAR	15 مم شفاف	GLASS	2990.00	SQM	t	2026-06-26 20:36:29.822	2026-06-26 20:36:29.822
cmqve5uki003ir0f65q8pywwm	GL-PL-20MM-CLEAR	20 مم شفاف	GLASS	4026.00	SQM	t	2026-06-26 20:36:29.826	2026-06-26 20:36:29.826
cmqve5ukl003jr0f6j0tgbym2	GL-PL-6MM-CRYSTAL	6 مم كريستال	GLASS	2109.00	SQM	t	2026-06-26 20:36:29.829	2026-06-26 20:36:29.829
cmqve5uko003kr0f6twhcwpl0	GL-PL-8MM-CRYSTAL	8 مم كريستال	GLASS	0.00	SQM	f	2026-06-26 20:36:29.832	2026-06-26 20:36:29.832
cmqve5uks003lr0f6c9qsfv7m	GL-PL-10MM-CRYSTAL	10 مم كريستال	GLASS	3021.00	SQM	t	2026-06-26 20:36:29.836	2026-06-26 20:36:29.836
cmqve5ukv003mr0f64katf1eo	GL-PL-15MM-CRYSTAL	15 مم كريستال	GLASS	0.00	SQM	f	2026-06-26 20:36:29.839	2026-06-26 20:36:29.839
cmqve5uky003nr0f6mjot9is3	GL-PL-20MM-CRYSTAL	20 مم كريستال	GLASS	6384.00	SQM	t	2026-06-26 20:36:29.842	2026-06-26 20:36:29.842
cmqve5ul1003or0f6u3xzg1rf	GL-PL-6MM-REFL-BR	6مم عاكس برونز	GLASS	0.00	SQM	f	2026-06-26 20:36:29.846	2026-06-26 20:36:29.846
cmqve5ul4003pr0f695i1c6l9	GL-PL-6MM-REFL-BL	6مم عاكس ازرق	GLASS	0.00	SQM	f	2026-06-26 20:36:29.848	2026-06-26 20:36:29.848
cmqve5ul7003qr0f6mey7irmk	GL-PL-6MM-REFL-GR	6مم عاكس رمادى	GLASS	0.00	SQM	f	2026-06-26 20:36:29.852	2026-06-26 20:36:29.852
cmqve5ulb003rr0f6z5r39fw9	GL-PL-6MM-COLORED	6مم برونز / ازرق	GLASS	0.00	SQM	f	2026-06-26 20:36:29.856	2026-06-26 20:36:29.856
cmqve5ulf003sr0f6wwo629gh	GL-PL-6MM-GRAY	6مم رمادى	GLASS	0.00	SQM	f	2026-06-26 20:36:29.859	2026-06-26 20:36:29.859
cmqve5ulh003tr0f6d07zfa0p	GL-PL-10MM-COLORED	10مم ملون رمادى / برونز / ازرق	GLASS	2120.00	SQM	t	2026-06-26 20:36:29.862	2026-06-26 20:36:29.862
cmqve5ulk003ur0f6xvde6boc	GL-PL-6MM-BOMB	6مم بومبيه	GLASS	0.00	SQM	f	2026-06-26 20:36:29.865	2026-06-26 20:36:29.865
cmqve5ulo003vr0f629xfendm	GL-PL-10MM-BOMB	10مم بومبيه	GLASS	0.00	SQM	f	2026-06-26 20:36:29.868	2026-06-26 20:36:29.868
cmqve5uls003wr0f6xhsf213n	GL-PL-12MM-BOMB	12مم بومبيه	GLASS	0.00	SQM	f	2026-06-26 20:36:29.873	2026-06-26 20:36:29.873
cmqve5ulv003xr0f6n1e3y8sj	ADD-TRM-SADA	ترميل سادة	GLASS_ADDON_AREA	108.00	SQM	t	2026-06-26 20:36:29.876	2026-06-26 20:36:29.876
cmqve5uly003yr0f6hteutejf	ADD-TRM-LINES	ترميل خطوط / مربعات	GLASS_ADDON_AREA	291.00	SQM	t	2026-06-26 20:36:29.879	2026-06-26 20:36:29.879
cmqve5um2003zr0f6fbspraca	ADD-TRM-LOGO	ترميل لوجو	GLASS_ADDON_AREA	0.00	SQM	f	2026-06-26 20:36:29.882	2026-06-26 20:36:29.882
cmqve5um50040r0f6ido28hu0	ADD-TRM-DEGRADE	ترميل ديجراديه	GLASS_ADDON_AREA	0.00	SQM	f	2026-06-26 20:36:29.885	2026-06-26 20:36:29.885
cmqve5um80041r0f6960k14ar	ADD-LASER	حفر ليزر	GLASS_ADDON_AREA	0.00	SQM	f	2026-06-26 20:36:29.889	2026-06-26 20:36:29.889
cmqve5umc0042r0f6gy6zb613	ADD-ACID-PRINT	طباعة حامض	GLASS_ADDON_AREA	0.00	SQM	f	2026-06-26 20:36:29.892	2026-06-26 20:36:29.892
cmqve5umf0043r0f60nu6crl5	ADD-RAL-PRINT	طباعة ريزن رال	GLASS_ADDON_AREA	509.00	SQM	t	2026-06-26 20:36:29.896	2026-06-26 20:36:29.896
cmqve5umi0044r0f6q53lumly	ADD-RESIN-BW	طباعة ريزن ابيض * اسود	GLASS_ADDON_AREA	0.00	SQM	f	2026-06-26 20:36:29.899	2026-06-26 20:36:29.899
cmqve5umm0045r0f6wmwqrixj	ADD-HEAT-PRINT	طباعة حرارى اسود و ابيض و احمر و رمادى	GLASS_ADDON_AREA	0.00	SQM	f	2026-06-26 20:36:29.902	2026-06-26 20:36:29.902
cmqve5ump0046r0f6ep7zr0xb	ADD-UV-NB	طباعة UV بدون خلفية	GLASS_ADDON_AREA	0.00	SQM	f	2026-06-26 20:36:29.906	2026-06-26 20:36:29.906
cmqve5ums0047r0f6r8cc1snv	ADD-UV-MB	طباعة UV بخلفية ماكنة	GLASS_ADDON_AREA	0.00	SQM	f	2026-06-26 20:36:29.909	2026-06-26 20:36:29.909
cmqve5umv0048r0f6txwu2lp7	ADD-UV-RB	طباعة UV بخلفية ريزن	GLASS_ADDON_AREA	0.00	SQM	f	2026-06-26 20:36:29.912	2026-06-26 20:36:29.912
cmqve5umy0049r0f6upuijcj0	ADD-CER-NB	طباعة سيراميك بدون خلفية	GLASS_ADDON_AREA	0.00	SQM	f	2026-06-26 20:36:29.915	2026-06-26 20:36:29.915
cmqve5un1004ar0f6a1f0md3o	ADD-CER-MB	طباعة سيراميك بخلفية ماكنة	GLASS_ADDON_AREA	0.00	SQM	f	2026-06-26 20:36:29.918	2026-06-26 20:36:29.918
cmqve5un5004br0f6q4w0en7v	ADD-CER-RB	طباعة سيراميك بخلفية ريزن	GLASS_ADDON_AREA	0.00	SQM	f	2026-06-26 20:36:29.921	2026-06-26 20:36:29.921
cmqve5un8004cr0f6z7p6w7h7	CHF-ALBA-10MM	شطف البا 10مم	CHAMFER	65.00	LINEAR_M	t	2026-06-26 20:36:29.924	2026-06-26 20:36:29.924
cmqve5unb004dr0f6lyer50ab	CHF-ALBA-1215MM	شطف البا 12مم / 15مم	CHAMFER	0.00	LINEAR_M	f	2026-06-26 20:36:29.928	2026-06-26 20:36:29.928
cmqve5unf004er0f60zow6ad9	CHF-ALBA-20MM	شطف البا 20مم	CHAMFER	0.00	LINEAR_M	f	2026-06-26 20:36:29.931	2026-06-26 20:36:29.931
cmqve5uni004fr0f6y92i3u6v	CHF-ALBA-6MM	شطف البا 6مم	CHAMFER	0.00	LINEAR_M	f	2026-06-26 20:36:29.935	2026-06-26 20:36:29.935
cmqve5unm004gr0f67a0nxacg	CHF-ALBA-66	شطف البا 6/6	CHAMFER	0.00	LINEAR_M	f	2026-06-26 20:36:29.939	2026-06-26 20:36:29.939
cmqve5unq004hr0f66mh9r4h6	CHF-ALBA-1010	شطف البا 10/10	CHAMFER	0.00	LINEAR_M	f	2026-06-26 20:36:29.942	2026-06-26 20:36:29.942
cmqve5unt004ir0f6cjxm6i2g	CHF-2-3MM	شطف 2مم / 3مم	CHAMFER	0.00	LINEAR_M	f	2026-06-26 20:36:29.946	2026-06-26 20:36:29.946
cmqve5unw004jr0f66agwej1w	CHF-1CM-6MM	شطف 1 سم سمك 6مم	CHAMFER	0.00	LINEAR_M	f	2026-06-26 20:36:29.949	2026-06-26 20:36:29.949
cmqve5uo0004kr0f6vy23jeqr	CHF-2CM-6MM	شطف 2 سم سمك 6مم	CHAMFER	0.00	LINEAR_M	f	2026-06-26 20:36:29.952	2026-06-26 20:36:29.952
cmqve5uo3004lr0f6cn77fl33	CHF-1-2CM-1012MM	شطف 1 سم / 2سم سمك 10مم / 12مم	CHAMFER	0.00	LINEAR_M	f	2026-06-26 20:36:29.955	2026-06-26 20:36:29.955
cmqve5uo6004mr0f6g2n8iv47	CHF-3CM-1012MM	شطف 3سم سمك 10مم / 12مم	CHAMFER	0.00	LINEAR_M	f	2026-06-26 20:36:29.958	2026-06-26 20:36:29.958
cmqve5uo9004nr0f6ys5duobq	CHF-3CM-6MM	شطف 3سم سمك 6مم	CHAMFER	0.00	LINEAR_M	f	2026-06-26 20:36:29.961	2026-06-26 20:36:29.961
cmqve5uoc004or0f6s3b3bki2	CHF-45-55MM	شطف زاوية 45 سمك 5مم / 5مم	CHAMFER	0.00	LINEAR_M	f	2026-06-26 20:36:29.964	2026-06-26 20:36:29.964
cmqve5uof004pr0f6asa4dwp0	CHF-45-10MM	شطف زاوية 45 سمك 10مم	CHAMFER	0.00	LINEAR_M	f	2026-06-26 20:36:29.967	2026-06-26 20:36:29.967
cmqve5uoi004qr0f6iyt1trwn	CHF-45-12MM	شطف زاوية 45 سمك 12مم	CHAMFER	0.00	LINEAR_M	f	2026-06-26 20:36:29.97	2026-06-26 20:36:29.97
cmqve5uol004rr0f6dzwvqkeh	CHF-ALBA	جلخ ألبا	CHAMFER	400.00	PIECE	t	2026-06-26 20:36:29.974	2026-06-26 20:36:29.974
cmqve5uop004sr0f6a0lpmg3s	SEC-U-BONE-SLV-KAF	قطاع U عظم فضى + كافر	SECTION	160.00	LINEAR_M	t	2026-06-26 20:36:29.977	2026-06-26 20:36:29.977
cmqve5uos004tr0f6yqbr4pk9	SEC-U-BONE-SLV-2KAF	قطاع U عظم فضى + 2 كافر	SECTION	264.50	LINEAR_M	t	2026-06-26 20:36:29.98	2026-06-26 20:36:29.98
cmqve5uov004ur0f6u0momb8p	SEC-U-BONE-BLK	قطاع U عظم اسود / ذهبى	SECTION	315.00	LINEAR_M	t	2026-06-26 20:36:29.984	2026-06-26 20:36:29.984
cmqve5uoz004vr0f6owlo6lhf	SEC-F-25-AL-SLV	F قطاع 2.5 سم الومنيوم فضى	SECTION	35.00	LINEAR_M	t	2026-06-26 20:36:29.987	2026-06-26 20:36:29.987
cmqve5up2004wr0f60qzegrus	SEC-F-35-AL-SLV	F قطاع 3.5 سم الومنيوم فضى	SECTION	45.00	LINEAR_M	t	2026-06-26 20:36:29.99	2026-06-26 20:36:29.99
cmqve5up6004xr0f62zptvl8e	SEC-F-25-GOLD	قطاع F ذهبى / اسود2.5	SECTION	55.00	LINEAR_M	t	2026-06-26 20:36:29.994	2026-06-26 20:36:29.994
cmqve5up9004yr0f6165l1m57	SEC-F-26-GOLD	قطاع F ذهبى / اسود2.6	SECTION	65.00	LINEAR_M	t	2026-06-26 20:36:29.997	2026-06-26 20:36:29.997
cmqve5upc004zr0f6jn5uf6wx	SEC-U-BOX-AL	علبة U الومنيوم	SECTION	95.00	LINEAR_M	t	2026-06-26 20:36:30	2026-06-26 20:36:30
cmqve5upf0050r0f63g25bn02	SEC-U-BOX-GOLD	علبة U ذهبى / اسود	SECTION	115.00	LINEAR_M	t	2026-06-26 20:36:30.004	2026-06-26 20:36:30.004
cmqve5upj0051r0f66l80owyi	SEC-SH-U-AL-2CM	U شاور الومنيوم فضى 2 سم	SECTION	48.00	LINEAR_M	t	2026-06-26 20:36:30.007	2026-06-26 20:36:30.007
cmqve5upn0052r0f6amzmx6x4	SEC-SH-U-AL-3CM	U شاور الومنيوم فضى 3 سم	SECTION	0.00	LINEAR_M	f	2026-06-26 20:36:30.011	2026-06-26 20:36:30.011
cmqve5upq0053r0f6sfzim9w5	SEC-SH-U-AL-4CM	U شاور الومنيوم فضى 4 سم	SECTION	80.00	LINEAR_M	t	2026-06-26 20:36:30.015	2026-06-26 20:36:30.015
cmqve5upu0054r0f6m8dp8mfx	SEC-SH-U-BK-2CM	U شاور اسود /  ذهبى 2 سم	SECTION	66.00	LINEAR_M	t	2026-06-26 20:36:30.018	2026-06-26 20:36:30.018
cmqve5upy0055r0f6naj5jkq1	SEC-SH-U-BK-3CM	U شاور اسود / ذهبى 3 سم	SECTION	0.00	LINEAR_M	f	2026-06-26 20:36:30.022	2026-06-26 20:36:30.022
cmqve5uq20056r0f6hiahjpzm	SEC-SH-U-BK-4CM	U شاور اسود / ذهبى 4 سم	SECTION	88.00	LINEAR_M	t	2026-06-26 20:36:30.026	2026-06-26 20:36:30.026
cmqve5uq50057r0f6ckpk5qm5	SEC-SH-U-STN-SLV	U شاور استانلس فضى	SECTION	285.00	LINEAR_M	t	2026-06-26 20:36:30.029	2026-06-26 20:36:30.029
cmqve5uq90058r0f61cssfrq0	SEC-MOUNT	قطاع التثبيت	SECTION	960.00	PIECE	t	2026-06-26 20:36:30.033	2026-06-26 20:36:30.033
cmqve5uqc0059r0f6dh6pjsn6	SEC-FACADE	قطاع	SECTION	491.00	LINEAR_M	t	2026-06-26 20:36:30.037	2026-06-26 20:36:30.037
cmqve5uqh005ar0f6650yu71v	DS-ACC-SLV	طقم اكسسوار فضى	DOOR_SET	1455.00	SET	t	2026-06-26 20:36:30.042	2026-06-26 20:36:30.042
cmqve5uql005br0f6i0wnqpvv	DS-ACC-BLACK	طقم اكسسوار اسود / ذهبى	DOOR_SET	1675.00	SET	t	2026-06-26 20:36:30.045	2026-06-26 20:36:30.045
cmqve5uqp005cr0f6ahrp0tlt	DS-ACC-GLX-SLV	طقم اكسسوار جلاسكس فضى	DOOR_SET	1950.00	SET	t	2026-06-26 20:36:30.049	2026-06-26 20:36:30.049
cmqve5uqs005dr0f61m0ycqbv	DS-ACC-GLX-BLACK	طقم اكسسوار جلاسكس أسود / ذهبى	DOOR_SET	2100.00	SET	t	2026-06-26 20:36:30.053	2026-06-26 20:36:30.053
cmqve5uqw005er0f6mo27arvq	DS-ACC-CONCPT-SLV	طقم اكسسوار كونسبت فضى	DOOR_SET	1600.00	SET	t	2026-06-26 20:36:30.056	2026-06-26 20:36:30.056
cmqve5uqz005fr0f6794onkvi	DS-ACC-CONCPT-BLACK	طقم اكسسوار كونسبت أسود / ذهبى	DOOR_SET	2150.00	SET	t	2026-06-26 20:36:30.06	2026-06-26 20:36:30.06
cmqve5ur2005gr0f6v22wt7z7	DS-ACC-MACH-SLV	طقم اكسسوار شامل مفصلة مكنة فضى	DOOR_SET	2555.00	SET	t	2026-06-26 20:36:30.063	2026-06-26 20:36:30.063
cmqve5ur5005hr0f6v45vymwy	DS-SL-FRENCH-SLV	طقم جرار فرنساوى فضى	DOOR_SET	2100.00	SET	t	2026-06-26 20:36:30.066	2026-06-26 20:36:30.066
cmqve5ur9005ir0f6tvew3lte	DS-SL-FRENCH-BLK	طقم جرار فرنساوى اسود	DOOR_SET	2300.00	SET	t	2026-06-26 20:36:30.069	2026-06-26 20:36:30.069
cmqve5urd005jr0f6osgcuktv	DS-SL-SPN-SLV	طقم جرار اسبانى فضى	DOOR_SET	1700.00	SET	t	2026-06-26 20:36:30.073	2026-06-26 20:36:30.073
cmqve5urh005kr0f6hak0ywt7	DS-SL-SPN-BLK	طقم جرار اسبانى اسود	DOOR_SET	1900.00	SET	t	2026-06-26 20:36:30.077	2026-06-26 20:36:30.077
cmqve5url005lr0f68a3h4ocs	DS-DOOR-KIT	طقم باب	DOOR_SET	1485.00	PIECE	t	2026-06-26 20:36:30.081	2026-06-26 20:36:30.081
cmqve5urp005mr0f6f3q5pwfn	MC-MAB-ITAL-NORMAL	ماكينة ماب ايطالى مقاس نمطى	MACHINE	3500.00	PIECE	t	2026-06-26 20:36:30.085	2026-06-26 20:36:30.085
cmqve5urt005nr0f686zphfic	MC-MAB-ITAL-LARGE	ماكينة ماب ايطالى مقاس كبير	MACHINE	0.00	PIECE	f	2026-06-26 20:36:30.089	2026-06-26 20:36:30.089
cmqve5urx005or0f624xgaa2d	MC-DORMA-NORMAL	ماكينة دورما مقاس نمطى	MACHINE	0.00	PIECE	f	2026-06-26 20:36:30.093	2026-06-26 20:36:30.093
cmqve5us1005pr0f6lc3gyhyi	MC-DORMA-LARGE	ماكينة دورما مقاس كبير	MACHINE	0.00	PIECE	f	2026-06-26 20:36:30.097	2026-06-26 20:36:30.097
cmqve5us4005qr0f6chusf5bk	MC-CHINESE	ماكينة صينى	MACHINE	1250.00	PIECE	t	2026-06-26 20:36:30.101	2026-06-26 20:36:30.101
cmqve5us8005rr0f63gcf6glz	MC-MAB	ماكينة ماب	MACHINE	5200.00	PIECE	t	2026-06-26 20:36:30.104	2026-06-26 20:36:30.104
cmqve5usc005sr0f67fomjota	HDL-60-SLV	مقبض 60 فضى	HANDLE	300.00	PIECE	t	2026-06-26 20:36:30.108	2026-06-26 20:36:30.108
cmqve5usg005tr0f6gaa093cb	HDL-60-GLX	مقبض 60 جلاسكس / كونسبت	HANDLE	400.00	PIECE	t	2026-06-26 20:36:30.112	2026-06-26 20:36:30.112
cmqve5usm005ur0f6obysjvka	HDL-60-BLK	مقبض 60 اسود	HANDLE	275.00	PIECE	t	2026-06-26 20:36:30.118	2026-06-26 20:36:30.118
cmqve5usq005vr0f6st9io5kb	HDL-80-SLV	مقبض 80 فضى	HANDLE	400.00	PIECE	t	2026-06-26 20:36:30.122	2026-06-26 20:36:30.122
cmqve5ust005wr0f6nbv9ki6s	HDL-80-BLK	مقبض 80 أسود	HANDLE	0.00	PIECE	f	2026-06-26 20:36:30.126	2026-06-26 20:36:30.126
cmqve5usx005xr0f6bi5a4c5w	HDL-120-SLV	مقبض 120 فضى	HANDLE	450.00	PIECE	t	2026-06-26 20:36:30.129	2026-06-26 20:36:30.129
cmqve5ut1005yr0f67fb9o08k	HDL-120-BLK	مقبض 120 اسود	HANDLE	600.00	PIECE	t	2026-06-26 20:36:30.133	2026-06-26 20:36:30.133
cmqve5ut5005zr0f63lp36gmr	HDL-150-SLV	مقبض 150 فضى	HANDLE	0.00	PIECE	f	2026-06-26 20:36:30.137	2026-06-26 20:36:30.137
cmqve5ut90060r0f6udfsa9hz	HDL-150-BLK	مقبض 150 اسود	HANDLE	0.00	PIECE	f	2026-06-26 20:36:30.141	2026-06-26 20:36:30.141
cmqve5utd0061r0f691ddwmxo	HDL-180-SLV	مقبض 180 فضى	HANDLE	0.00	PIECE	f	2026-06-26 20:36:30.145	2026-06-26 20:36:30.145
cmqve5utg0062r0f6178obi9y	HDL-180-BLK	مقبض 180 اسود	HANDLE	0.00	PIECE	f	2026-06-26 20:36:30.149	2026-06-26 20:36:30.149
cmqve5utk0063r0f6qgdfm4b4	HDL-INTERIOR	مقبض انتريور	HANDLE	0.00	PIECE	f	2026-06-26 20:36:30.153	2026-06-26 20:36:30.153
cmqve5uto0064r0f6hzd6lmmd	HDL-REC-5CM	مقبض غاطس 5سم	HANDLE	110.00	PIECE	t	2026-06-26 20:36:30.156	2026-06-26 20:36:30.156
cmqve5uts0065r0f6gt1shjvo	HDL-NOB-BLK	مقبض نوب اسود / ذهبى	HANDLE	80.00	PIECE	t	2026-06-26 20:36:30.16	2026-06-26 20:36:30.16
cmqve5utw0066r0f6m9gddtz8	HDL-FWT-4020-SLV	مقبض فواطة 40 * 20 فضى	HANDLE	250.00	PIECE	t	2026-06-26 20:36:30.164	2026-06-26 20:36:30.164
cmqve5utz0067r0f6s4sgrcem	HDL-FWT-4020-BLK	مقبض فواطة 40 * 20 اسود / ذهبى	HANDLE	275.00	PIECE	t	2026-06-26 20:36:30.167	2026-06-26 20:36:30.167
cmqve5uu30068r0f6lg3g58i7	HDL-FWT-4020-SQ	مقبض فواطة 40 * 20 فضى مربع استانلس	HANDLE	0.00	PIECE	f	2026-06-26 20:36:30.171	2026-06-26 20:36:30.171
cmqve5uu70069r0f63qe4qcqj	HDL-LOCK-3030-MT	مقبض مقفول 30 * 30 استانلس مط	HANDLE	120.00	PIECE	t	2026-06-26 20:36:30.175	2026-06-26 20:36:30.175
cmqve5uua006ar0f6i22o518z	HDL-LOCK-3030-BLK	مقبض مقفول 30 * 30 اسود / ذهبى	HANDLE	140.00	PIECE	t	2026-06-26 20:36:30.178	2026-06-26 20:36:30.178
cmqve5uuf006br0f6tylu56pw	HDL-LOCK-2020-STN	مقبض مقفول 20* 20 استانلس	HANDLE	220.00	PIECE	t	2026-06-26 20:36:30.183	2026-06-26 20:36:30.183
cmqve5uui006cr0f6hnuoc9v7	HDL-LOCK-2020-BLK	مقبض مقفول 20* 20 اسود / ذهبى	HANDLE	200.00	PIECE	t	2026-06-26 20:36:30.187	2026-06-26 20:36:30.187
cmqve5uum006dr0f6vfq36doz	HDL-LOCK-4040	مقبض مقفول 40*40	HANDLE	430.00	PIECE	t	2026-06-26 20:36:30.19	2026-06-26 20:36:30.19
cmqve5uuq006er0f609l28mpx	HDL-LOCK-4040-BLK	مقبض مقفول 40*40 اسود / ذهبى	HANDLE	480.00	PIECE	t	2026-06-26 20:36:30.194	2026-06-26 20:36:30.194
cmqve5uuu006fr0f6zo3n7dw7	HDL-60	مقبض 60	HANDLE	412.00	PIECE	t	2026-06-26 20:36:30.198	2026-06-26 20:36:30.198
cmqve5uux006gr0f6i5j7scay	OC-HINGE-180-ZZ-ZN	مفصلات 180 ز*ز زنك	OPEN_CLOSE	290.00	PIECE	t	2026-06-26 20:36:30.201	2026-06-26 20:36:30.201
cmqve5uv1006hr0f6lafi0eic	OC-HINGE-90-ZH-ZN	مفصلات 90 ز*ح زنك	OPEN_CLOSE	190.00	PIECE	t	2026-06-26 20:36:30.205	2026-06-26 20:36:30.205
cmqve5uv5006ir0f6t1no2ytg	OC-HINGE-90-ZZ-ZN	مفصلات 90 ز*ز زنك	OPEN_CLOSE	320.00	PIECE	t	2026-06-26 20:36:30.209	2026-06-26 20:36:30.209
cmqve5uv8006jr0f6nhnjefho	OC-HINGE-135-ZZ-SLV	مفصلات  135 ز*ز فضى	OPEN_CLOSE	320.00	PIECE	t	2026-06-26 20:36:30.213	2026-06-26 20:36:30.213
cmqve5uvc006kr0f64nd2wzvh	OC-HINGE-180-ZZ-BLK	مفصلات 180 ز*ز  اسود	OPEN_CLOSE	350.00	PIECE	t	2026-06-26 20:36:30.216	2026-06-26 20:36:30.216
cmqve5uvf006lr0f6rvoopk26	OC-HINGE-90-ZH-BLK	مفصلات 90 ز*ح اسود	OPEN_CLOSE	260.00	PIECE	t	2026-06-26 20:36:30.219	2026-06-26 20:36:30.219
cmqve5uvk006mr0f6rjhw7bm6	OC-HINGE-180-ZZ-GLX	مفصلات 180 ز*ز  استانلس جلاسكس / كونسبت	OPEN_CLOSE	380.00	PIECE	t	2026-06-26 20:36:30.224	2026-06-26 20:36:30.224
cmqve5uvo006nr0f6ozqkcnju	OC-HINGE-90-ZH-GLX	مفصلات 90 ز*ح استانلس جلاسكس / كونسبت	OPEN_CLOSE	290.00	PIECE	t	2026-06-26 20:36:30.229	2026-06-26 20:36:30.229
cmqve5uvs006or0f6lmiijk69	OC-SL-FR-SLV-GLOSS	طقم جرار فرنساوى فضى لامع	OPEN_CLOSE	2300.00	SET	t	2026-06-26 20:36:30.232	2026-06-26 20:36:30.232
cmqve5uvv006pr0f6cprisbxe	OC-SL-FR-SLV-MAT	طقم جرار فرنساوى فضى مط	OPEN_CLOSE	2100.00	SET	t	2026-06-26 20:36:30.236	2026-06-26 20:36:30.236
cmqve5uvz006qr0f67mv5q1gk	OC-SL-FR-BLK	طقم جرار فرنساوى اسود	OPEN_CLOSE	2500.00	SET	t	2026-06-26 20:36:30.24	2026-06-26 20:36:30.24
cmqve5uw3006rr0f69mb551hk	OC-SL-SP-SLV	طقم جرار اسبانى فضى	OPEN_CLOSE	1900.00	SET	t	2026-06-26 20:36:30.243	2026-06-26 20:36:30.243
cmqve5uw6006sr0f6qbq49tys	OC-SL-SP-BLK	طقم جرار اسبانى اسود	OPEN_CLOSE	2100.00	SET	t	2026-06-26 20:36:30.247	2026-06-26 20:36:30.247
cmqve5uwa006tr0f67w0ptvph	OC-SL-BE-SLV	طقم جرار بيلجيكى فضى	OPEN_CLOSE	1900.00	SET	t	2026-06-26 20:36:30.25	2026-06-26 20:36:30.25
cmqve5uwd006ur0f6jxifyyqn	OC-SL-BE-BLK	طقم جرار بيلجيكى اسود	OPEN_CLOSE	2100.00	SET	t	2026-06-26 20:36:30.254	2026-06-26 20:36:30.254
cmqve5uwi006vr0f6ifok28xl	ACC-ANGLE-SLV	زاوية او لقم فضى	ACCESSORY	65.00	PIECE	t	2026-06-26 20:36:30.258	2026-06-26 20:36:30.258
cmqve5uwm006wr0f62by7xhs7	ACC-ANGLE-BLK	زاوية او لقم اسود / ذهبى	ACCESSORY	70.00	PIECE	t	2026-06-26 20:36:30.262	2026-06-26 20:36:30.262
cmqve5uwp006xr0f6jw4tbzi4	ACC-ANGLE-STN	زاوية او لقم استانلس	ACCESSORY	150.00	PIECE	t	2026-06-26 20:36:30.266	2026-06-26 20:36:30.266
cmqve5uws006yr0f6mvnmy4ps	ACC-SCREW-HALF	مسمار نص	ACCESSORY	45.00	PIECE	t	2026-06-26 20:36:30.269	2026-06-26 20:36:30.269
cmqve5uww006zr0f6iutuf6ua	ACC-ANGLES	زوايا	ACCESSORY	70.00	PIECE	t	2026-06-26 20:36:30.273	2026-06-26 20:36:30.273
cmqve5ux00070r0f62tja17es	TEN-CEILING	للسقف	TENSION	50.00	PIECE	t	2026-06-26 20:36:30.276	2026-06-26 20:36:30.276
cmqve5ux30071r0f6umoaibwt	TEN-SLV	شداد فضى	TENSION	150.00	PIECE	t	2026-06-26 20:36:30.279	2026-06-26 20:36:30.279
cmqve5ux60072r0f6zwlrbv3z	TEN-BLK	شداد اسود / ذهبى	TENSION	175.00	PIECE	t	2026-06-26 20:36:30.282	2026-06-26 20:36:30.282
cmqve5ux90073r0f6j7pe9d8p	ELB-SLV	كوع فضى	ELBOW	85.00	PIECE	t	2026-06-26 20:36:30.285	2026-06-26 20:36:30.285
cmqve5uxd0074r0f6b8y66sdv	ELB-BLK	كوع اسود / ذهبى	ELBOW	125.00	PIECE	t	2026-06-26 20:36:30.289	2026-06-26 20:36:30.289
cmqve5uxi0075r0f67dnng0a9	ELB-GLX-STN	كوع استانلس جلاسكس او كونسبت	ELBOW	215.00	PIECE	t	2026-06-26 20:36:30.294	2026-06-26 20:36:30.294
cmqve5uxl0076r0f6v9xcyvk7	CEL-CLEAR	شفاف	CEILING_STRIP	100.00	PIECE	t	2026-06-26 20:36:30.298	2026-06-26 20:36:30.298
cmqve5uxo0077r0f6kppj3ekj	CEL-BLACK	اسود	CEILING_STRIP	150.00	PIECE	t	2026-06-26 20:36:30.301	2026-06-26 20:36:30.301
cmqve5uxs0078r0f63z93qkk1	CEL-MAGNET	مغناطيس	CEILING_STRIP	280.00	PIECE	t	2026-06-26 20:36:30.304	2026-06-26 20:36:30.304
cmqve5uxw0079r0f6oi0km4ii	LCH-SIG-SLV-FULL	كالون اشارة فضى كامل	LATCH	660.00	PIECE	t	2026-06-26 20:36:30.308	2026-06-26 20:36:30.308
cmqve5uy0007ar0f67zmugvq5	LCH-SIG-SLV-FACE	كالون اشارة فضى + وش	LATCH	360.00	PIECE	t	2026-06-26 20:36:30.312	2026-06-26 20:36:30.312
cmqve5uy3007br0f6ucq43t12	LCH-SIG-SLV-HOOK	كالون اشارة بخطاف فضى	LATCH	0.00	PIECE	f	2026-06-26 20:36:30.315	2026-06-26 20:36:30.315
cmqve5uy7007cr0f6mfm62ayx	LCH-SIG-BLK-FULL	كالون اشارة اسود كامل	LATCH	700.00	PIECE	t	2026-06-26 20:36:30.319	2026-06-26 20:36:30.319
cmqve5uyb007dr0f6tyxk5ej8	LCH-SIG-BLK-FACE	كالون اشارة اسود + وش	LATCH	410.00	PIECE	t	2026-06-26 20:36:30.323	2026-06-26 20:36:30.323
cmqve5uyf007er0f62t92kdom	LCH-SIG-BLK-HOOK	كالون اشارة بخطاف اسود	LATCH	0.00	PIECE	f	2026-06-26 20:36:30.327	2026-06-26 20:36:30.327
cmqve5uyi007fr0f62ys1spom	LCH-INTERIOR	كالون انتريور	LATCH	1100.00	PIECE	t	2026-06-26 20:36:30.331	2026-06-26 20:36:30.331
cmqve5uym007gr0f60q6dwylf	SPI-DOUBLE	اسبايدر زوجي	SPIDER	1800.00	PIECE	t	2026-06-26 20:36:30.334	2026-06-26 20:36:30.334
cmqve5uyq007hr0f6vaxrsfd6	SPI-SINGLE	اسبايدر ثنائي	SPIDER	900.00	PIECE	t	2026-06-26 20:36:30.339	2026-06-26 20:36:30.339
cmqve5uyu007ir0f6ehw3osij	SPI-MID-PLATE	بلتة وسط	SPIDER	2325.00	PIECE	t	2026-06-26 20:36:30.342	2026-06-26 20:36:30.342
cmqve5uyx007jr0f6dj6795np	SPI-GND-PLATE	بلتة ارضي	SPIDER	1200.00	PIECE	t	2026-06-26 20:36:30.346	2026-06-26 20:36:30.346
cmqve5uz2007kr0f69frr0b11	OTH-WOOD	خشب	OTHER	200.00	SQM	t	2026-06-26 20:36:30.351	2026-06-26 20:36:30.351
cmqve5uz6007lr0f6t0ucenu6	OTH-SILICONE	سيليكون	OTHER	190.00	PIECE	t	2026-06-26 20:36:30.354	2026-06-26 20:36:30.354
cmqve5uza007mr0f6lrswk63u	OTH-RESIN-SPRAY	رش ريزن	OTHER	510.00	SQM	t	2026-06-26 20:36:30.359	2026-06-26 20:36:30.359
cmqve5uze007nr0f6h6jj7gmb	OTH-SANDING	صنفرة	OTHER	108.00	SQM	t	2026-06-26 20:36:30.362	2026-06-26 20:36:30.362
cmqve5uzh007or0f6ro3svv2g	OTH-COPING-BAR	كوبستة	OTHER	1400.00	PIECE	t	2026-06-26 20:36:30.366	2026-06-26 20:36:30.366
cmqve5uzm007pr0f6g0cqru09	OTH-CUPS	كوبايات	OTHER	400.00	PIECE	t	2026-06-26 20:36:30.371	2026-06-26 20:36:30.371
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notification" (id, "userId", title, body, type, "entityId", "entityType", "isRead", "createdAt") FROM stdin;
cmr9l3h2x0005p4243tywf9a1	cmq2rzssz0003r797cmrgivyj	notifications.newInspectionTitle	تم إنشاء طلب معاينة جديد للعميل ٌRamez	INSPECTION_CREATED	cmr9l3h1s0001p424xsoj45z2	InspectionRequest	f	2026-07-06 18:59:22.808
cmr9hoxu60007p424qdwq6nz5	cmq2rzss60000r797smq1obgf	notifications.lowFactorApprovalTitle	طلب موافقة على خصم 19% لعرض السعر Q-2026-00004	DISCOUNT_APPROVAL_REQUESTED	cmr9hoxrf0001p424ge80p3io	Quotation	t	2026-07-06 17:24:05.838
cmra5s19r0009nd3lofbmkw8k	cmq2rzssz0003r797cmrgivyj	notifications.newInspectionTitle	تم إنشاء طلب معاينة جديد للعميل حسين ابراهيم	INSPECTION_CREATED	cmra5s1910005nd3l97la7vqt	InspectionRequest	f	2026-07-07 04:38:21.039
cmra63khg000dnd3lb5dntz6p	cmq2rzss60000r797smq1obgf	notifications.quotationApprovedTitle	تم اعتماد عرض السعر QUO-2026-0020	QUOTATION_APPROVED	cmra_hussein_q001	Quotation	f	2026-07-07 04:47:19.156
cmra6e8fg000ynd3lipjdsnbe	cmq2rzss60000r797smq1obgf	notifications.quotationApprovedTitle	تم اعتماد عرض السعر Q-2026-00006	QUOTATION_APPROVED	cmra6d89u000pnd3ll6o9fww8	Quotation	f	2026-07-07 04:55:36.748
cmradbf7h0007nd3elp3s7ymq	cmq2rzss60000r797smq1obgf	notifications.quotationApprovedTitle	تم اعتماد عرض السعر Q-2026-00004	QUOTATION_APPROVED	cmr9hoxrf0001p424ge80p3io	Quotation	f	2026-07-07 08:09:22.878
cmrade91q000dnd3ec050omjq	cmq2rzss60000r797smq1obgf	notifications.quotationApprovedTitle	تم اعتماد عرض السعر Q-2026-00003	QUOTATION_APPROVED	cmr88ae8z0001p424xf3ehxzo	Quotation	f	2026-07-07 08:11:34.862
cmradf1rn000nnd3e811qct9p	cmq2rzss60000r797smq1obgf	notifications.lowFactorApprovalTitle	طلب موافقة على خصم 25% لعرض السعر Q-2026-00007	DISCOUNT_APPROVAL_REQUESTED	cmradf1r3000hnd3ez9uddtit	Quotation	t	2026-07-07 08:12:12.083
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Payment" (id, "quotationId", amount, "paidAt", method, notes, "createdById", "createdAt") FROM stdin;
\.


--
-- Data for Name: PriceListItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PriceListItem" (id, category, spec, unit, price, "isActive", "updatedById", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PricingFactor; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PricingFactor" (id, value, label, "isActive", "createdAt", "updatedAt") FROM stdin;
cmqve5u5c0001r0f6kwsm7cy9	1.60	1.6	t	2026-06-26 20:36:29.28	2026-06-26 20:36:29.28
cmqve5u5g0002r0f6x2p2qfu0	1.70	1.7	t	2026-06-26 20:36:29.284	2026-06-26 20:36:29.284
cmqve5u5k0003r0f6zlsu9vag	1.80	1.8	t	2026-06-26 20:36:29.288	2026-06-26 20:36:29.288
cmqve5u5o0004r0f64eey0rrq	1.90	1.9	t	2026-06-26 20:36:29.292	2026-06-26 20:36:29.292
cmqve5u5s0005r0f6k7olwk09	2.00	2.0	t	2026-06-26 20:36:29.296	2026-06-26 20:36:29.296
cmqve5u510000r0f66j8qkltk	1.50	1.5	t	2026-06-26 20:36:29.269	2026-06-26 20:36:29.269
\.


--
-- Data for Name: ProductRecipe; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductRecipe" (id, "productTypeId", "materialId", "qtyRule", "defaultQty", notes, "createdAt", "updatedAt", "customFactor", "factorMode") FROM stdin;
cmqve5v1c008jr0f6ea688mk5	cmqve5u6b0007r0f6f46s6vh3	cmqve5uf10021r0f6ony8yiua	BY_AREA	0.90	\N	2026-06-26 20:36:30.432	2026-06-26 20:36:30.432	\N	STANDARD
cmqve5v1j008lr0f6s8eytp8q	cmqve5u6b0007r0f6f46s6vh3	cmqve5uq90058r0f61cssfrq0	FIXED	1.00	\N	2026-06-26 20:36:30.439	2026-06-26 20:36:30.439	\N	STANDARD
cmqve5v1p008nr0f6sii6tnms	cmqve5u6b0007r0f6f46s6vh3	cmqve5uzh007or0f6ro3svv2g	FIXED	1.00	\N	2026-06-26 20:36:30.445	2026-06-26 20:36:30.445	\N	STANDARD
cmqve5v1v008pr0f6egv00b9m	cmqve5u6i0008r0f64wc24oz1	cmqve5uf10021r0f6ony8yiua	BY_AREA	0.90	\N	2026-06-26 20:36:30.451	2026-06-26 20:36:30.451	\N	STANDARD
cmqve5v21008rr0f6vry4d90i	cmqve5u6i0008r0f64wc24oz1	cmqve5uz2007kr0f69frr0b11	BY_AREA	0.90	\N	2026-06-26 20:36:30.457	2026-06-26 20:36:30.457	\N	STANDARD
cmqve5v26008tr0f62zx6xxxt	cmqve5u6i0008r0f64wc24oz1	cmqve5uzm007pr0f6g0cqru09	FIXED	4.00	\N	2026-06-26 20:36:30.463	2026-06-26 20:36:30.463	\N	STANDARD
cmqve5v2c008vr0f6fgmgiosb	cmqve5u6i0008r0f64wc24oz1	cmqve5uzh007or0f6ro3svv2g	FIXED	1.00	\N	2026-06-26 20:36:30.468	2026-06-26 20:36:30.468	\N	STANDARD
cmqve5v2t0091r0f6n8r5puyt	cmqve5u6n0009r0f6js5ncbj2	cmqve5uza007mr0f6lrswk63u	BY_AREA	1.00	\N	2026-06-26 20:36:30.486	2026-06-26 20:36:30.486	\N	STANDARD
cmqve5v2y0093r0f6d0vuia3v	cmqve5u6n0009r0f6js5ncbj2	cmqve5uz6007lr0f6t0ucenu6	FIXED	1.00	\N	2026-06-26 20:36:30.491	2026-06-26 20:36:30.491	\N	STANDARD
cmqve5v350095r0f6xjlstcww	cmqve5u6n0009r0f6js5ncbj2	cmqve5uz2007kr0f69frr0b11	BY_AREA	1.00	\N	2026-06-26 20:36:30.498	2026-06-26 20:36:30.498	\N	STANDARD
cmqve5v3n009br0f6en63oupp	cmqve5u6y000br0f6xz4d7qae	cmqve5uww006zr0f6iutuf6ua	FIXED	5.00	\N	2026-06-26 20:36:30.515	2026-06-26 20:36:30.515	\N	STANDARD
cmqve5v3s009dr0f67nv2dwyf	cmqve5u6y000br0f6xz4d7qae	cmqve5uz6007lr0f6t0ucenu6	FIXED	1.00	\N	2026-06-26 20:36:30.52	2026-06-26 20:36:30.52	\N	STANDARD
cmqve5v46009hr0f65c3juodx	cmqve5u74000cr0f6qsf621mz	cmqve5uze007nr0f6h6jj7gmb	BY_AREA	1.00	\N	2026-06-26 20:36:30.534	2026-06-26 20:36:30.534	\N	STANDARD
cmqve5v4b009jr0f6tyepthp5	cmqve5u74000cr0f6qsf621mz	cmqve5uww006zr0f6iutuf6ua	FIXED	5.00	\N	2026-06-26 20:36:30.539	2026-06-26 20:36:30.539	\N	STANDARD
cmqve5v4g009lr0f6l9w7wpwk	cmqve5u74000cr0f6qsf621mz	cmqve5uz6007lr0f6t0ucenu6	FIXED	1.00	\N	2026-06-26 20:36:30.544	2026-06-26 20:36:30.544	\N	STANDARD
cmqve5v4k009nr0f6ix6s0ar2	cmqve5u79000dr0f6exscw9hn	cmqve5uaj000xr0f6n9ug50im	BY_AREA	21.84	\N	2026-06-26 20:36:30.549	2026-06-26 20:36:30.549	\N	STANDARD
cmqve5v4p009pr0f6t7rm5adi	cmqve5u79000dr0f6exscw9hn	cmqve5uqc0059r0f6dh6pjsn6	BY_LENGTH	20.40	\N	2026-06-26 20:36:30.553	2026-06-26 20:36:30.553	\N	STANDARD
cmqve5v4u009rr0f62ij41rtr	cmqve5u79000dr0f6exscw9hn	cmqve5url005lr0f68a3h4ocs	FIXED	2.00	\N	2026-06-26 20:36:30.558	2026-06-26 20:36:30.558	\N	STANDARD
cmqve5v50009tr0f6acjynn96	cmqve5u79000dr0f6exscw9hn	cmqve5uuu006fr0f6zo3n7dw7	FIXED	2.00	\N	2026-06-26 20:36:30.564	2026-06-26 20:36:30.564	\N	STANDARD
cmqve5v59009xr0f6t2izbkiy	cmqve5u7l000er0f6ejqdpmuh	cmqve5ud6001kr0f6iou4gm3o	BY_AREA	49.63	\N	2026-06-26 20:36:30.574	2026-06-26 20:36:30.574	\N	STANDARD
cmqve5v5i009zr0f6fz0t6vxu	cmqve5u7l000er0f6ejqdpmuh	cmqve5uqc0059r0f6dh6pjsn6	BY_LENGTH	29.36	\N	2026-06-26 20:36:30.582	2026-06-26 20:36:30.582	\N	STANDARD
cmqve5v5n00a1r0f65few0fxo	cmqve5u7l000er0f6ejqdpmuh	cmqve5uym007gr0f60q6dwylf	FIXED	6.00	\N	2026-06-26 20:36:30.588	2026-06-26 20:36:30.588	\N	STANDARD
cmqve5v5s00a3r0f6f9abn4ep	cmqve5u7l000er0f6ejqdpmuh	cmqve5uyq007hr0f6vaxrsfd6	FIXED	14.00	\N	2026-06-26 20:36:30.593	2026-06-26 20:36:30.593	\N	STANDARD
cmqve5v5x00a5r0f6jyjmvfm7	cmqve5u7l000er0f6ejqdpmuh	cmqve5uww006zr0f6iutuf6ua	FIXED	24.00	\N	2026-06-26 20:36:30.597	2026-06-26 20:36:30.597	\N	STANDARD
cmqve5v6200a7r0f6b4yg7w7w	cmqve5u7l000er0f6ejqdpmuh	cmqve5uyu007ir0f6ehw3osij	FIXED	6.00	\N	2026-06-26 20:36:30.603	2026-06-26 20:36:30.603	\N	STANDARD
cmqve5v6a00a9r0f6xd3a4036	cmqve5u7l000er0f6ejqdpmuh	cmqve5uyx007jr0f6dj6795np	FIXED	12.00	\N	2026-06-26 20:36:30.61	2026-06-26 20:36:30.61	\N	STANDARD
cmqve5v6l00abr0f6m6ege15i	cmqve5u7l000er0f6ejqdpmuh	cmqve5uek001wr0f6vwgsmsg4	BY_AREA	11.09	\N	2026-06-26 20:36:30.621	2026-06-26 20:36:30.621	\N	STANDARD
cmqve5v2i008xr0f6jpxci7tu	cmqve5u6i0008r0f64wc24oz1	cmqve5uol004rr0f6dzwvqkeh	MANUAL	\N	\N	2026-06-26 20:36:30.474	2026-06-26 20:36:30.474	\N	FIXED_AFTER
cmqve5v54009vr0f6hg6c1wo7	cmqve5u79000dr0f6exscw9hn	cmqve5us8005rr0f63gcf6glz	FIXED	2.00	\N	2026-06-26 20:36:30.568	2026-06-26 20:36:30.568	1.50	CUSTOM_FACTOR
cmr81l4m90000p482l6gaoozh	cmqve5u5z0006r0f6dikq90u1	cmqve5u84000fr0f62t4z99fg	BY_AREA	1.00	GLASS	2026-07-05 17:05:27.969	2026-07-05 17:05:27.965	\N	STANDARD
cmr81l4m90001p4826v79pt4o	cmqve5u5z0006r0f6dikq90u1	cmqve5u8h000gr0f6z2bwn7qu	BY_AREA	1.00	GLASS	2026-07-05 17:05:27.969	2026-07-05 17:05:27.965	\N	STANDARD
cmr81l4m90002p4827ep8jrbl	cmqve5u5z0006r0f6dikq90u1	cmqve5u8n000hr0f6x8od2djv	BY_AREA	1.00	GLASS	2026-07-05 17:05:27.969	2026-07-05 17:05:27.965	\N	STANDARD
cmr81l4m90003p482er5lw1lx	cmqve5u5z0006r0f6dikq90u1	cmqve5uq90058r0f61cssfrq0	BY_LENGTH	1.00	SECTION	2026-07-05 17:05:27.969	2026-07-05 17:05:27.965	\N	STANDARD
cmr81l4m90004p482y20wukax	cmqve5u5z0006r0f6dikq90u1	cmqve5upj0051r0f66l80owyi	BY_LENGTH	1.00	SECTION	2026-07-05 17:05:27.969	2026-07-05 17:05:27.965	\N	STANDARD
cmr81l4m90005p482oxcc6n7l	cmqve5u5z0006r0f6dikq90u1	cmqve5ux30071r0f6umoaibwt	FIXED	1.00	TENSION	2026-07-05 17:05:27.969	2026-07-05 17:05:27.965	\N	FIXED_AFTER
cmr81l4m90006p482mbrrb1lk	cmqve5u5z0006r0f6dikq90u1	cmqve5ux60072r0f6zwlrbv3z	FIXED	1.00	TENSION	2026-07-05 17:05:27.969	2026-07-05 17:05:27.965	\N	FIXED_AFTER
cmr81l4m90007p482no06f114	cmqve5u5z0006r0f6dikq90u1	cmqve5usc005sr0f67fomjota	FIXED	1.00	HANDLE	2026-07-05 17:05:27.969	2026-07-05 17:05:27.965	\N	FIXED_AFTER
cmqve5v2o008zr0f62n0628np	cmqve5u6n0009r0f6js5ncbj2	cmqve5uk1003dr0f6prazo40e	BY_AREA	1.00	GLASS	2026-06-26 20:36:30.48	2026-07-05 18:22:16.68	\N	STANDARD
cmqve5v3b0097r0f6vged3v1p	cmqve5u6t000ar0f631dsrzze	cmqve5uk1003dr0f6prazo40e	BY_AREA	7.80	GLASS	2026-06-26 20:36:30.503	2026-07-05 18:22:16.68	\N	STANDARD
cmqve5v3h0099r0f6gwr4109p	cmqve5u6y000br0f6xz4d7qae	cmqve5uk1003dr0f6prazo40e	BY_AREA	1.00	GLASS	2026-06-26 20:36:30.509	2026-07-05 18:22:16.68	\N	STANDARD
cmqve5v40009fr0f6f7d4z85d	cmqve5u74000cr0f6qsf621mz	cmqve5uk1003dr0f6prazo40e	BY_AREA	1.00	GLASS	2026-06-26 20:36:30.528	2026-07-05 18:22:16.68	\N	STANDARD
cmr81l4ma0008p482878eer18	cmqve5u5z0006r0f6dikq90u1	cmqve5usm005ur0f6obysjvka	FIXED	1.00	HANDLE	2026-07-05 17:05:27.969	2026-07-05 17:05:27.965	\N	FIXED_AFTER
cmr81l4ma0009p48233x6hjnj	cmqve5u5z0006r0f6dikq90u1	cmqve5ux90073r0f6j7pe9d8p	FIXED	1.00	ELBOW	2026-07-05 17:05:27.969	2026-07-05 17:05:27.965	\N	FIXED_AFTER
cmr81l4ma000ap482w01e54iv	cmqve5u5z0006r0f6dikq90u1	cmqve5uxd0074r0f6b8y66sdv	FIXED	1.00	ELBOW	2026-07-05 17:05:27.969	2026-07-05 17:05:27.965	\N	FIXED_AFTER
cmr81l4ma000bp482q4n8m1sq	cmqve5u5z0006r0f6dikq90u1	cmqve5uz6007lr0f6t0ucenu6	FIXED	1.00	SILICON	2026-07-05 17:05:27.969	2026-07-05 17:05:27.965	\N	FIXED_AFTER
\.


--
-- Data for Name: QuotationItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."QuotationItem" (id, "quotationId", description, quantity, "unitPrice", "lineTotal") FROM stdin;
cmq2rzsu7000hr797y9nig9rv	cmq2rzsu7000gr797mk2lwjqp	زجاج سيكوريت 10مم	50.00	800.00	40000.00
cmq2rzsu7000ir797clsspiiw	cmq2rzsu7000gr797mk2lwjqp	زجاج سيكوريت 6مم	20.00	500.00	10000.00
cmq2rzsuk000lr797vsmipzms	cmq2rzsuk000kr7970j79qbec	واجهة زجاجية سيكوريت 12مم	80.00	1200.00	96000.00
cmq2rzsuk000mr79776iwsipe	cmq2rzsuk000kr7970j79qbec	باب زجاج مفصلات أرضية	4.00	6000.00	24000.00
cmr88ae900002p4248nunoitb	cmr88ae8z0001p424xf3ehxzo	عرض تجريبي - 1	1.00	190.00	190.00
cmr9hoxrg0002p424j333yrgj	cmr9hoxrf0001p424ge80p3io	Qut - 1	1.00	7224.21	7224.21
cmra6d89u000qnd3lswlxpn8h	cmra6d89u000pnd3ll6o9fww8	أبواب زجاجية - مكتب المعادي - 1	1.00	571334.40	571334.40
cmradf1r3000ind3ev4rl451n	cmradf1r3000hnd3ez9uddtit	xdcf - 1	1.00	34757.78	34757.78
\.


--
-- Data for Name: Referral; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Referral" (id, "referrerId", "newCustomerId", "newQuotationId", "referralOrder", "cashbackPct", "baseAmount", "cashbackAmount", status, "createdAt", "paidAt") FROM stdin;
\.


--
-- Data for Name: SystemSettings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SystemSettings" (id, "discountBasePct", "discountMaxReqPct", "vatPct", "quotationValidDays", "cashbackActive", "cashbackStartDate", "companyLogoUrl", "companyName", "updatedById", "updatedAt", "factorMinimum") FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
60ed0f55-717c-40fc-ae39-14b231839693	6a98ec19ba2d259b89f6626558be828eed41110b652052a1c23aebaba5cb46ec	2026-06-06 19:52:53.544072+00	20260606180004_init	\N	\N	2026-06-06 19:52:53.133318+00	1
dcff7e4c-54f8-43a5-bb2e-6062413a7a30	ee5dd11fad89e03a81f4852189cd4c74dca3188cdd0d99e3307d867ad5268de7	2026-06-20 21:23:46.644568+00	20260620212346_phase1_batch1_review_inspection_type	\N	\N	2026-06-20 21:23:46.626619+00	1
8d3fefdb-ffb5-447d-ac11-97fec875aa03	fe25a345908cd40a74926999a30f1322d499f0b18866fc76e9e5a0e48faf541f	2026-07-06 13:49:39.496524+00	20260706134939_add_factor_minimum	\N	\N	2026-07-06 13:49:39.448818+00	1
c328b328-baa9-481f-8ed5-8ffb5763b289	c7c13f71245d9cd529ac253f5bfdcbd85ec7e02aaf5cff4832745ad9d56dc66b	2026-06-20 21:37:32.627897+00	20260620213732_phase1_batch2_review_discount_quotationtype	\N	\N	2026-06-20 21:37:32.555784+00	1
9c6f94c7-684a-496c-85c7-78680dc95355	128e8f0bd3186c8d9a708fa8c8d4fdce7af99ec5c1433e1db1f1f1610fa9cc31	2026-06-20 21:47:13.91455+00	20260620214713_phase1_batch3_settings_cashback_pricelist	\N	\N	2026-06-20 21:47:13.819357+00	1
3e62e3ca-112f-4eba-8b88-3f1c9bfa5d71	614f90090842c5d3d9e806c06d078ecbd36b6436d1fe554a5411775145c0b672	2026-06-26 20:31:37.495051+00	20260626202538_add_catalog_tables	\N	\N	2026-06-26 20:31:37.355293+00	1
8f2f34ef-537e-4c60-8ea1-835cf91ef453	71f098aabbcec5e0a4e3c0341eb1bd6fbf635ff5c43037c475028bfae499f19a	2026-07-07 05:10:16.006795+00	20260707051015_add_contract_documents_pipeline_stage	\N	\N	2026-07-07 05:10:15.927081+00	1
dacb1b2e-36c8-4709-ba84-5fb2878bfa42	2f77ae3479f20a0109578100b8bc0612340960f812219ee5f91cda88d68eaacf	2026-06-27 12:34:12.567135+00	20260627062409_add_factor_mode	\N	\N	2026-06-27 12:34:12.519448+00	1
52eef1e0-cdee-43b0-b592-175d21a8f858	655f919bf4ddc7e6e4aa0d3f5351740a48b5eb6c4b445240a1751d74c2cf6fe5	2026-07-05 21:53:37.158022+00	20260705215336_add_notifications	\N	\N	2026-07-05 21:53:37.072894+00	1
d6971fe6-1ab1-4dc5-989a-435471a12a31	87a2e7ecd0a649384a3e396ed4495e28614aa00b6d3ede8672c1386523ee584f	2026-07-05 22:08:04.10835+00	20260705220803_add_manufacturing_orders	\N	\N	2026-07-05 22:08:04.029879+00	1
1b837a9c-61c5-4c86-9a22-2575b890ab8d	52e905b85fde805edebbc4a60c185563604171a4900f9ab519a7ecda84777f06	2026-07-07 12:54:59.475105+00	20260707125459_tec_scr010	\N	\N	2026-07-07 12:54:59.306512+00	1
ed36df0c-25bb-4197-a756-fa09b4d283bf	35f13f48e898c8728ccede1e4b900b23eb9edabe689ce30e2f69e6c26abe05f5	2026-07-05 22:18:19.777253+00	20260705221819_add_installation_orders	\N	\N	2026-07-05 22:18:19.696536+00	1
615f899e-3e76-433c-a909-6de87850b039	3245260e6dcb262f5816cdfcea5c48168a934e7ded7d530ae07503486c56b053	2026-07-05 22:35:42.687544+00	20260705223542_add_payments	\N	\N	2026-07-05 22:35:42.62531+00	1
d926748b-b4ea-49a4-991a-e5ad11e08959	702af1073173f3c02d1ee92b1129c7a366c6c649ce3bee03de8cd4f6c9541cb8	2026-07-05 22:46:22.394392+00	20260705224622_add_hr	\N	\N	2026-07-05 22:46:22.308711+00	1
ea52ae96-6a36-4155-b97f-53d544c6728e	01dcf8c5d0d5ff004ec393b6cbbb15be150c19e719b2e1cd10bb63cda87dee90	2026-07-07 21:23:13.126223+00	20260707212312_scr_010_011_vip_postinstall	\N	\N	2026-07-07 21:23:13.050433+00	1
f9c088a5-f496-4d1e-b75c-ea912064c958	782e0c54a913891d0c1b9e44bda3cd7751de7cbe0e748b1633c834535bd2eb76	2026-07-05 23:05:42.40257+00	20260705230542_add_projects	\N	\N	2026-07-05 23:05:42.325528+00	1
749ab535-019b-4fec-8d9b-91acfdfc7ddb	7eac8b4aff6541fe1da54cf5694e7844158e9d692805f81ff992df8bd8c32df7	2026-07-06 06:29:09.942186+00	20260706062909_add_quotation_approval_and_inspection_media	\N	\N	2026-07-06 06:29:09.819168+00	1
02327522-5f9f-47f0-9e05-2b0b56db94d2	5c58dd135445c45b23b43f249221f6a0a369b7537ac049e8408a4184d67b0409	2026-07-08 05:12:13.301492+00	20260708051213_scr_012_site_readiness	\N	\N	2026-07-08 05:12:13.289503+00	1
2aeece1d-f44d-4594-8f70-b08a559f3e0b	ec0434f186686285e63dad5203e349567d9a284ede037c498e2c0a9246876eb1	2026-07-08 09:00:04.076447+00	20260708090003_scr_013_inspection_rep_departments	\N	\N	2026-07-08 09:00:04.058543+00	1
\.


--
-- Data for Name: contracts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contracts (id, "customerId", "quotationId", "signedAt", notes, "createdById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.documents (id, "entityType", "entityId", filename, "originalName", "mimeType", "sizeBytes", url, label, "uploadedById", "createdAt") FROM stdin;
\.


--
-- Data for Name: quotation_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quotation_requests (id, code, status, "technicalRoute", summary, notes, "customerId", "quotationId", "inspectionRequestId", "engineerId", "salesOwnerId", "inspectionOwnerId", "createdAt", "updatedAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: drawings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.drawings (id, category, "fileType", filename, "originalName", "mimeType", url, "sizeBytes", label, notes, revision, "quotationRequestId", "uploadedById", "approvedById", "approvedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: extra_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.extra_items (id, type, description, qty, "unitCost", notes, "manufacturingOrderId", "createdById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: inspection_measurements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inspection_measurements (id, "inspectionId", label, value, unit, "minSpec", "maxSpec", result, notes, "recordedById", "recordedAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: inspection_photos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inspection_photos (id, "inspectionId", filename, "originalName", "mimeType", "sizeBytes", url, caption, "takenAt", "uploadedById", "createdAt") FROM stdin;
\.


--
-- Data for Name: post_install_reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.post_install_reviews (id, "customerId", "contractId", rating, notes, issues, status, "createdById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: quotation_approvals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quotation_approvals (id, "quotationId", "requestedById", "reviewedById", factor, reason, decision, "rejectionNote", "createdAt", "decidedAt") FROM stdin;
\.


--
-- PostgreSQL database dump complete
--

\unrestrict q05Ty6AwvUBYXE3gdQe7z2xabfG7p6vrtrFKr8uFvHZfLrMm0O273nn1dp6LA9J

