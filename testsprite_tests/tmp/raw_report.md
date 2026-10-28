
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** pick-art
- **Date:** 2026-01-05
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001
- **Test Name:** TC001-Instagram Hashtag Crawling - Normal Flow
- **Test Code:** [TC001_Instagram_Hashtag_Crawling___Normal_Flow.py](./TC001_Instagram_Hashtag_Crawling___Normal_Flow.py)
- **Test Error:** The Instagram hashtag crawler was triggered and posts were confirmed stored in the database by viewing a detailed post. However, attempts to extract Instagram posts data for duplicate and error rate analysis failed because the current interface only shows event listings and no Instagram post information. Repeated navigation attempts to access the crawler results or database view failed. Reporting this issue and stopping further actions.
Browser Console Logs:
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/4879ae04-2a8d-4ab2-bc04-79c93690e543
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002
- **Test Name:** TC002-Public Institution Website Crawling - Edge Cases and Error Handling
- **Test Code:** [TC002_Public_Institution_Website_Crawling___Edge_Cases_and_Error_Handling.py](./TC002_Public_Institution_Website_Crawling___Edge_Cases_and_Error_Handling.py)
- **Test Error:** The test page for simulating malformed HTML on the public institution website returned a 404 error and was not found. Therefore, the crawler behavior test for malformed HTML could not be performed as planned. The issue has been reported. For the remaining tests on slow server response and missing required metadata fields, alternative test setups or URLs are needed. Task is marked as incomplete due to missing test resources.
Browser Console Logs:
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/malformed-html-simulation:0:0)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/48907640-1f15-41df-a28b-5e9b56452614
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003
- **Test Name:** TC003-AI Metadata Extraction Accuracy
- **Test Code:** [TC003_AI_Metadata_Extraction_Accuracy.py](./TC003_AI_Metadata_Extraction_Accuracy.py)
- **Test Error:** Reported the website issue due to unresponsive or missing functionality for feeding sample raw event data to the AI metadata extractor. Testing cannot proceed further without this functionality.
Browser Console Logs:
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/0fdc2e3c-78c5-45c1-a669-986170fe1fdf
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004
- **Test Name:** TC004-Duplicate Detection Logic
- **Test Code:** [TC004_Duplicate_Detection_Logic.py](./TC004_Duplicate_Detection_Logic.py)
- **Test Error:** Stopped testing due to inability to access event input form required for duplicate detection testing. Reported the issue to the development team.
Browser Console Logs:
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/b11eee1e-9d98-45f5-8bfa-3645680f9c81
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005
- **Test Name:** TC005-Image Optimization and Storage
- **Test Code:** [TC005_Image_Optimization_and_Storage.py](./TC005_Image_Optimization_and_Storage.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/974f60de-af8d-4340-8f7c-527b0670d9ba
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006
- **Test Name:** TC006-Admin Dashboard Workflow - Data Verification and Approval
- **Test Code:** [TC006_Admin_Dashboard_Workflow___Data_Verification_and_Approval.py](./TC006_Admin_Dashboard_Workflow___Data_Verification_and_Approval.py)
- **Test Error:** Reported the 404 error on the admin login page. Cannot proceed with testing the admin dashboard due to inaccessible login page.
Browser Console Logs:
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/login?_rsc=vusbg:0:0)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/login:0:0)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/7dc2daed-fa3f-4161-a55c-cf074dcba7f3
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007
- **Test Name:** TC007-Admin Dashboard - DM Management and Response Handling
- **Test Code:** [TC007_Admin_Dashboard___DM_Management_and_Response_Handling.py](./TC007_Admin_Dashboard___DM_Management_and_Response_Handling.py)
- **Test Error:** Testing cannot proceed because the admin dashboard and login functionality are broken. Clicking login leads to a 404 error page. Please fix the routing and authentication issues to enable testing of DM sending and approval status updates.
Browser Console Logs:
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/login?_rsc=1szk4:0:0)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/login:0:0)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/login?_rsc=1e9w2:0:0)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/login:0:0)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/b973ebc3-1746-4b4e-8818-67f579432061
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008
- **Test Name:** TC008-User Website - Event Search and Filtering
- **Test Code:** [TC008_User_Website___Event_Search_and_Filtering.py](./TC008_User_Website___Event_Search_and_Filtering.py)
- **Test Error:** Tested filtering by location and category successfully with visual results. The event date filter is not functional and does not change results when clicked. Unable to measure page load time from the page content as no timing data is available. Filtering by date cannot be verified. Overall, filtering partially works but the date filter and page load time verification failed due to lack of functionality and data. Recommend fixing the event date filter and adding performance metrics for full testing.
Browser Console Logs:
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/f6360b37-56f8-4308-894d-e594caf3ac95
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009
- **Test Name:** TC009-User Event Detail and Sharing Functionality
- **Test Code:** [TC009_User_Event_Detail_and_Sharing_Functionality.py](./TC009_User_Event_Detail_and_Sharing_Functionality.py)
- **Test Error:** Event details are visible and accurate. However, the share button does not trigger any sharing functionality or open a share dialog, so sharing could not be validated. Task partially completed with this issue reported.
Browser Console Logs:
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
[ERROR] Copy failed NotAllowedError: Failed to execute 'writeText' on 'Clipboard': Write permission denied. (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:3127:31)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/12511acc-99ea-4884-9c0e-a0b6b3554380
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010
- **Test Name:** TC010-Security - Admin Access Control
- **Test Code:** [TC010_Security___Admin_Access_Control.py](./TC010_Security___Admin_Access_Control.py)
- **Test Error:** Testing stopped due to missing login page (404 error). Cannot verify admin authentication and role-based permissions without a working login page.
Browser Console Logs:
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/login?_rsc=vusbg:0:0)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/login?_rsc=vusbg:0:0)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/login:0:0)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/540e424b-670d-4db8-b226-9a92f4e0f6fa
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC011
- **Test Name:** TC011-System Uptime and Recovery
- **Test Code:** [TC011_System_Uptime_and_Recovery.py](./TC011_System_Uptime_and_Recovery.py)
- **Test Error:** Reported the issue that failure simulation controls are missing on the system page. Cannot proceed with the task to simulate system failures and verify uptime and recovery. Task stopped.
Browser Console Logs:
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/f1e85efa-b217-4467-bca9-e42d6a67df17
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC012
- **Test Name:** TC012-Telegram Notification System
- **Test Code:** [TC012_Telegram_Notification_System.py](./TC012_Telegram_Notification_System.py)
- **Test Error:** The system event triggering mechanism works, but there is no visible or accessible UI element or log to verify that Telegram-based notifications are sent to admins reliably and in real-time. The website issue has been reported due to the lack of verification options. Direct verification via Telegram or backend logs is recommended for confirmation.
Browser Console Logs:
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/e3dc1bc9-e57f-47a7-a535-0ddddab073ce
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC013
- **Test Name:** TC013-Privacy Compliance and Data Protection
- **Test Code:** [TC013_Privacy_Compliance_and_Data_Protection.py](./TC013_Privacy_Compliance_and_Data_Protection.py)
- **Test Error:** Testing stopped due to absence of privacy policy and consent workflow on the website, preventing verification of privacy compliance including encryption and consent mechanisms.
Browser Console Logs:
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/login?_rsc=vusbg:0:0)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/login:0:0)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/b61e55d9-d6b1-4cc6-8ce7-2f331e83dac7
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC014
- **Test Name:** TC014-Performance - API Response Times Under Load
- **Test Code:** [TC014_Performance___API_Response_Times_Under_Load.py](./TC014_Performance___API_Response_Times_Under_Load.py)
- **Test Error:** Tested search and event details APIs successfully. Unable to access admin data API due to 404 error on admin page. Reporting issue and stopping further testing as full response time measurement cannot be completed.
Browser Console Logs:
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
[ERROR] Failed to load resource: net::ERR_CONNECTION_CLOSED (at https://fastly.picsum.photos/id/155/400/600.jpg?hmac=iQ178G73I-_PfvgZuoAIuD1Y17WaC2_aPTDsj9kBXXY:0:0)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/login?_rsc=7iw23:0:0)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/login:0:0)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/eb755130-9a90-4afc-a058-c22c6ac759d1
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC015
- **Test Name:** TC015-User Experience - Mobile First Responsive Design
- **Test Code:** [TC015_User_Experience___Mobile_First_Responsive_Design.py](./TC015_User_Experience___Mobile_First_Responsive_Design.py)
- **Test Error:** Testing stopped due to non-functional button blocking navigation and filtering usability tests. Homepage UI is stable in desktop view but mobile responsiveness and usability could not be validated. Please fix the button functionality to proceed.
Browser Console Logs:
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
[WARNING] Image with src "https://picsum.photos/seed/3/400/600" was detected as the Largest Contentful Paint (LCP). Please add the `loading="eager"` property if this image is above the fold.
Read more: https://nextjs.org/docs/app/api-reference/components/image#loading (at http://localhost:3000/_next/static/chunks/9e883_next_dist_e24ad472._.js:2297:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/65c059e3-358d-406d-99dc-f1a901218ebf/e5cc8209-b163-438b-9b0c-076c2d4de5e1
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **6.67** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---