<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CategoryController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    public function index()
    {
        return CategoryResource::collection(
            Category::query()->withCount('products')->orderBy('parent_id')->orderBy('sort_order')->orderBy('name')->get()
        );
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['slug'] = $this->slug($data['slug'] ?? $data['name']);

        $category = Category::create($data);
        $this->audit->log('category.created', $category, [], $data);

        return (new CategoryResource($category))->response()->setStatusCode(201);
    }

    public function update(Request $request, Category $category): CategoryResource
    {
        $data = $this->validated($request, $category);
        if (isset($data['slug'])) {
            $data['slug'] = $this->slug($data['slug'], $category->id);
        }
        if (($data['parent_id'] ?? null) === $category->id) {
            throw ValidationException::withMessages(['parent_id' => 'A category cannot be its own parent.']);
        }

        $old = $category->only(array_keys($data));
        $category->update($data);
        $this->audit->log('category.updated', $category, $old, $data);

        return new CategoryResource($category);
    }

    public function destroy(Category $category): JsonResponse
    {
        if ($category->products()->withTrashed()->exists()) {
            throw ValidationException::withMessages(['category' => 'This category has products. Deactivate it instead, or move the products first.']);
        }
        $category->children()->update(['parent_id' => null]);
        $category->delete();
        $this->audit->log('category.deleted', $category);

        return response()->json(['message' => 'Category deleted.']);
    }

    private function validated(Request $request, ?Category $category = null): array
    {
        return $request->validate([
            'name' => [$category ? 'sometimes' : 'required', 'string', 'max:100'],
            'slug' => ['nullable', 'string', 'max:120', 'alpha_dash'],
            'parent_id' => ['nullable', 'integer', Rule::exists('categories', 'id')->whereNull('parent_id')],
            'description' => ['nullable', 'string', 'max:500'],
            'image_url' => ['nullable', 'url', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'between:0,1000'],
        ]);
    }

    private function slug(string $value, ?int $ignore = null): string
    {
        $base = Str::slug($value) ?: 'category';
        $slug = $base;
        $i = 2;
        while (Category::where('slug', $slug)->when($ignore, fn ($q) => $q->whereKeyNot($ignore))->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
