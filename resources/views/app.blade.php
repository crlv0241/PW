<!DOCTYPE html>
@php
    $settings = \App\Models\SystemSetting::current();
@endphp
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        @if ($settings->favicon_url)
            <link rel="icon" href="{{ $settings->favicon_url }}">
        @else
            <link rel="icon" href="/favicon.ico" sizes="any">
            <link rel="icon" href="/favicon.svg" type="image/svg+xml">
            <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        @endif

        <style>
            :root {
                --brand-primary: {{ $settings->primary_color }};
                --brand-accent: {{ $settings->accent_color }};
            }
        </style>

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ $settings->company_name }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased selection:bg-indigo-500 selection:text-white">
        <x-inertia::app />
    </body>
</html>
