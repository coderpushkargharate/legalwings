'use client';

import React from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import AdminOnly from '@/components/template/admin-only';
import TemplateEditor from '@/components/template/template-editor';

export default function NewTemplatePage() {
  return (
    <AppShell>
      <Header title="Create Template" />
      <AdminOnly>
        <TemplateEditor />
      </AdminOnly>
    </AppShell>
  );
}
