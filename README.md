# FriendChise
[![CI](https://github.com/IvanTran-2001/FriendChise/actions/workflows/ci.yml/badge.svg)](https://github.com/IvanTran-2001/FriendChise/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=next.js)](https://nextjs.org)
[![Deploy](https://img.shields.io/badge/deploy-friendchise.app-brightgreen)](https://friendchise.app)

> **Helping every location operate like its best one.**

Production-tested workplace operations platform used to help manage real business operations while preserving operational knowledge and standardising workflows.

<p align="center">
  <a href="https://friendchise.app">🌐 Live Demo</a> •
  <a href="#features">✨ Features</a> •
  <a href="#getting-started">🚀 Getting Started</a> •
  <a href="CONTRIBUTING.md">🤝 Contributing</a>
</p>


![FriendChise dashboard overview](public/docs/timetable.gif)

# Why FriendChise Exists

FriendChise started with a simple belief:

> The success of one location should strengthen every location.

Too often, valuable operational knowledge stays within individual stores instead of being shared across the business. New staff repeat old mistakes, successful processes remain isolated, and every location ends up solving the same problems independently.

FriendChise was built to preserve knowledge, standardise operations, and help every location benefit from the experience of the best-performing teams.

Today, FriendChise brings operational knowledge, workforce management, business tools, and collaboration together into one platform that grows alongside a business.

---

# Platform Overview

Rather than relying on disconnected spreadsheets, paper documents, messaging apps, and standalone tools, FriendChise brings the day-to-day operations of a business into one central platform.

---

## 📖 Operations & Knowledge

Capture, organise, and share the knowledge that keeps every location running consistently.

- Tasks and recurring workflows
- Procedures and recipes
- Comments and discussions
- Knowledge base
- Announcements
- Searchable operational documentation

![Tasks](public/docs/task.gif)

---

## 👥 Workforce Management

Coordinate staff through scheduling tools designed for repetitive workplaces.

- Interactive timetable
- Drag-and-drop scheduling
- Grouped overlapping shifts
- Responsive day and week views
- Staff roster management

![Timetable](public/docs/timetable.gif)

---

## 🛠 Business Tools

Reduce repetitive administrative work with tools designed to simplify everyday business operations and replace disconnected workflows.

The platform is designed to continuously expand with new operational tools as businesses grow.

- Roster Builder
- Conversion Tool
- Operational Calculators
- Menu & QR Generator
- Item Lists

![Tools](public/docs/tool.gif)

---

## 🏢 Organisation Management

Manage multiple businesses and locations while maintaining secure separation between organisations.

- Multi-tenant architecture
- Franchise hierarchy
- Custom roles
- Granular permissions
- Organisation switching

![Franchise](public/docs/franchise.gif)

---

## 📊 Administration

Monitor and manage the platform with built-in administrative tools.

- Activity logs
- Feedback management
- User analytics
- Error monitoring
- Operational dashboards

![Admin](public/docs/admin.gif)

---

## 🎯 Guided Interactive Demo

Built-in onboarding guides new users through FriendChise, making new features easier to discover and reducing onboarding time.

![Demo](public/docs/demo.gif)


# Technical Architecture

FriendChise is designed as a modular, production-tested Next.js application with a focus on scalability, maintainability, and long-term growth.

The platform is organised into modular systems so new features can be developed independently while remaining consistent with the rest of the application.

Highlights include:

- Multi-tenant organisation architecture
- Role-based access control (RBAC)
- Modular service architecture
- Server-side validation
- Guided demo framework
- Automated testing
- Responsive component architecture


## 🧪 Testing & Reliability

Maintain application quality through automated unit, integration, API, and end-to-end testing using Vitest and Playwright, helping ensure new features remain reliable as the platform evolves.

# Getting Started

Read the setup flow in [quick-setup](https://friendchise.app/doc/contributing/getting-started).

# Contributing

Contributions of all sizes are welcome.

If you'd like to improve FriendChise:

1. Open an issue to discuss your idea.

2. Read the Contributing Guide.

3. Browse the contribution ideas if you're looking for somewhere to start.

4. Submit a pull request.

If you find the project useful, consider starring the repository.

# Documentation

The full documentation is available at:

**https://friendchise.app/doc**

It includes architecture, setup guides, contributing documentation, API references, and implementation details.

If you notice missing or outdated documentation, feel free to open an issue or submit a pull request.

# Technology Stack

### Frontend

- Next.js 16

- React 19

- TypeScript

- Tailwind CSS

- shadcn/ui

- Radix UI

### Backend

- Prisma ORM

- PostgreSQL

- Auth.js

- Supabase Storage

- Upstash Redis

### Infrastructure

- Supabase Storage
- Upstash Redis

### Developer Tooling

- pnpm
- Vitest
- Playwright
- Sentry

# Roadmap

Planned improvements include:

- AI-assisted scheduling
- OCR document scanning
- Paperless workflow tools
- Expanded operational tool library
- Advanced reporting and analytics
- Additional onboarding experiences

