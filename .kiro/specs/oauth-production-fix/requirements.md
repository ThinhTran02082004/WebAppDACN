# Requirements Document

## Introduction

Hệ thống đăng nhập OAuth (Google/Facebook) hoạt động bình thường trên localhost nhưng gặp lỗi 404 khi deploy lên production (Railway backend + Vercel frontend). Server redirect thành công đến URL `/auth/social-callback` với data, nhưng Vercel không tìm thấy route này và trả về lỗi 404: NOT_FOUND.

## Glossary

- **OAuth System**: Hệ thống xác thực người dùng thông qua Google và Facebook
- **Railway Backend**: Server Node.js được deploy trên Railway
- **Vercel Frontend**: React SPA được deploy trên Vercel
- **Social Callback Route**: Route `/auth/social-callback` xử lý redirect từ OAuth providers
- **Vercel Rewrites**: Cấu hình routing của Vercel để xử lý SPA routes

## Requirements

### Requirement 1

**User Story:** Là một người dùng, tôi muốn đăng nhập bằng Google/Facebook trên production environment, để tôi có thể truy cập hệ thống mà không gặp lỗi 404

#### Acceptance Criteria

1. WHEN người dùng click đăng nhập Google/Facebook trên production, THE OAuth System SHALL redirect về frontend callback route thành công
2. WHEN server redirect đến `/auth/social-callback` với user data, THE Vercel Frontend SHALL hiển thị trang callback và xử lý authentication
3. THE Vercel Frontend SHALL có cấu hình rewrites để xử lý tất cả SPA routes bao gồm `/auth/social-callback`
4. WHEN OAuth callback hoàn tất, THE OAuth System SHALL redirect người dùng đến trang dashboard hoặc home page

### Requirement 2

**User Story:** Là một developer, tôi muốn cấu hình Vercel rewrites đúng cách, để tất cả client-side routes hoạt động trên production

#### Acceptance Criteria

1. THE Vercel Frontend SHALL có file `vercel.json` với cấu hình rewrites
2. THE Vercel Rewrites SHALL redirect tất cả routes về `index.html` để React Router xử lý
3. THE Vercel Rewrites SHALL không ảnh hưởng đến các static assets (CSS, JS, images)
4. WHEN deploy lên Vercel, THE Vercel Frontend SHALL áp dụng cấu hình rewrites tự động

### Requirement 3

**User Story:** Là một developer, tôi muốn kiểm tra OAuth flow hoạt động đúng trên cả localhost và production, để đảm bảo tính nhất quán

#### Acceptance Criteria

1. WHEN test OAuth trên localhost, THE OAuth System SHALL hoạt động bình thường
2. WHEN test OAuth trên production, THE OAuth System SHALL hoạt động giống như localhost
3. THE OAuth System SHALL log đầy đủ thông tin để debug khi có lỗi
4. WHEN OAuth callback thất bại, THE OAuth System SHALL hiển thị thông báo lỗi rõ ràng cho người dùng
