// CES EN-TÊTES NE SONT PAS CEUX D'UNREAL ENGINE.
//
// Ils déclarent, sans rien implémenter, le petit sous-ensemble de l'API d'Unreal 5.8 qu'utilise
// unreal/LinkFoot/Source, avec les signatures relevées dans la référence d'Epic
// (dev.epicgames.com/documentation/unreal-engine/API, version 5.8). Ils servent à une seule chose :
// vérifier, hors d'Unreal, que notre propre code est cohérent (noms, types, constance, includes de
// nos fichiers). Passer cette vérification ne vaut pas une compilation dans Unreal : seule
// l'Unreal Build Tool, avec les vrais en-têtes, le prouve (unreal/README.md).
#pragma once

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <string>
#include <utility>
#include <vector>
#include <algorithm>
#include <memory>
#include <map>
#include <cwchar>

using int8 = std::int8_t;
using uint8 = std::uint8_t;
using int16 = std::int16_t;
using uint16 = std::uint16_t;
using int32 = std::int32_t;
using uint32 = std::uint32_t;
using int64 = std::int64_t;
using uint64 = std::uint64_t;
using TCHAR = wchar_t;
using ANSICHAR = char;
#define TEXT(x) L##x
#define UE_ARRAY_COUNT(a) (sizeof(a) / sizeof((a)[0]))
#define INDEX_NONE (-1)
#define WITH_DEV_AUTOMATION_TESTS 1

// --- macros de réflexion : effacées
#define UCLASS(...)
#define USTRUCT(...)
#define UENUM(...)
#define UPROPERTY(...)
#define UFUNCTION(...)
#define UMETA(...)
#define LINKFOOTCORE_API
#define LINKFOOTMATCH_API
#define LINKFOOTPLAYER_API
#define LINKFOOTDEBUG_API
#define LINKFOOT_API
#define UE_LOG(Categorie, Verbosite, Format, ...) ((void)(Format))

template <typename T> T&& MoveTemp(T& v) { return static_cast<T&&>(v); }

struct FMath
{
	template <typename T> static T Clamp(T v, T a, T b) { return v < a ? a : (v > b ? b : v); }
	template <typename T> static T Max(T a, T b) { return a > b ? a : b; }
	template <typename T> static T Min(T a, T b) { return a < b ? a : b; }
	template <typename T> static T Abs(T a) { return a < 0 ? -a : a; }
	static double Sqrt(double v) { return std::sqrt(v); }
};

// --- conteneurs
template <typename T>
class TArray
{
public:
	TArray() = default;
	TArray(std::initializer_list<T> l) : v(l) {}
	int32 Num() const { return static_cast<int32>(v.size()); }
	bool IsEmpty() const { return v.empty(); }
	int32 Add(const T& x) { v.push_back(x); return Num() - 1; }
	void Reset(int32 = 0) { v.clear(); }
	void Reserve(int32 n) { v.reserve(static_cast<std::size_t>(n)); }
	int32 Remove(const T& x) { const auto n = v.size(); v.erase(std::remove(v.begin(), v.end(), x), v.end()); return static_cast<int32>(n - v.size()); }
	void RemoveAt(int32 i) { v.erase(v.begin() + i); }
	void Sort() { std::sort(v.begin(), v.end()); }
	T& Last() { return v.back(); }
	const T& Last() const { return v.back(); }
	T& operator[](int32 i) { return v[static_cast<std::size_t>(i)]; }
	const T& operator[](int32 i) const { return v[static_cast<std::size_t>(i)]; }
	T* GetData() { return v.data(); }
	const T* GetData() const { return v.data(); }
	auto begin() { return v.begin(); }
	auto end() { return v.end(); }
	auto begin() const { return v.begin(); }
	auto end() const { return v.end(); }
private:
	std::vector<T> v;
};

template <typename K, typename V>
class TMap
{
public:
	V& Add(const K& k, const V& x) { return m[k] = x; }
	V* Find(const K& k) { auto it = m.find(k); return it == m.end() ? nullptr : &it->second; }
	const V* Find(const K& k) const { auto it = m.find(k); return it == m.end() ? nullptr : &it->second; }
private:
	std::map<K, V> m;
};

template <typename T>
class TUniquePtr
{
public:
	TUniquePtr() = default;
	TUniquePtr(TUniquePtr&& o) : p(std::move(o.p)) {}
	TUniquePtr& operator=(TUniquePtr&& o) { p = std::move(o.p); return *this; }
	explicit TUniquePtr(T* x) : p(x) {}
	T* Get() const { return p.get(); }
	bool IsValid() const { return p != nullptr; }
	void Reset() { p.reset(); }
	T* operator->() const { return p.get(); }
	T& operator*() const { return *p; }
	explicit operator bool() const { return p != nullptr; }
private:
	std::unique_ptr<T> p;
};
template <typename T, typename... A> TUniquePtr<T> MakeUnique(A&&... a) { return TUniquePtr<T>(new T(std::forward<A>(a)...)); }

// --- texte
class FString
{
public:
	FString() = default;
	FString(const TCHAR* s) : t(s ? s : L"") {}
	FString(const std::wstring& s) : t(s) {}
	const TCHAR* operator*() const { return t.c_str(); }
	bool IsEmpty() const { return t.empty(); }
	int32 Len() const { return static_cast<int32>(t.size()); }
	bool StartsWith(const FString& p) const { return t.rfind(p.t, 0) == 0; }
	FString& operator+=(const FString& o) { t += o.t; return *this; }
	friend FString operator+(const FString& a, const FString& b) { return FString(a.t + b.t); }
	friend FString operator+(const TCHAR* a, const FString& b) { return FString(std::wstring(a) + b.t); }
	friend FString operator+(const FString& a, const TCHAR* b) { return FString(a.t + std::wstring(b)); }
	friend FString operator/(const FString& a, const FString& b) { return FString(a.t + L"/" + b.t); }
	friend FString operator/(const FString& a, const TCHAR* b) { return FString(a.t + L"/" + std::wstring(b)); }
	bool operator==(const FString& o) const { return t == o.t; }
	bool operator<(const FString& o) const { return t < o.t; }
	// La référence d'Unreal exige que le format soit un tableau de TCHAR littéral.
	template <std::size_t N, typename... A>
	static FString Printf(const TCHAR (&Format)[N], A... Args) { (void)Format; ((void)Args, ...); return FString(); }
private:
	std::wstring t;
};

class FName
{
public:
	FName() = default;
	FName(const TCHAR* s) : t(s) {}
	bool operator<(const FName& o) const { return t < o.t; }
	bool operator==(const FName& o) const { return t == o.t; }
private:
	std::wstring t;
};
#define NAME_None FName()

// UTF8_TO_TCHAR : un objet temporaire de conversion, qui se lit comme un const TCHAR*
struct FUTF8ToTCHAR_Simule
{
	explicit FUTF8ToTCHAR_Simule(const char*) {}
	operator const TCHAR*() const { return L""; }
};
#define UTF8_TO_TCHAR(s) ((const TCHAR*)FUTF8ToTCHAR_Simule(s))

class FTCHARToUTF8
{
public:
	explicit FTCHARToUTF8(const TCHAR*) {}
	const ANSICHAR* Get() const { return ""; }
	int32 Length() const { return 0; }
};

// --- mathématiques
struct FQuat;
struct FRotator;
struct FVector
{
	double X = 0, Y = 0, Z = 0;
	FVector() = default;
	FVector(double x, double y, double z) : X(x), Y(y), Z(z) {}
	explicit FVector(double v) : X(v), Y(v), Z(v) {}
	static const FVector ZeroVector;
	static const FVector UpVector;
	FVector operator+(const FVector& o) const { return { X + o.X, Y + o.Y, Z + o.Z }; }
	FVector operator-(const FVector& o) const { return { X - o.X, Y - o.Y, Z - o.Z }; }
	FVector operator*(double s) const { return { X * s, Y * s, Z * s }; }
	FVector operator/(double s) const { return { X / s, Y / s, Z / s }; }
	double Size() const { return std::sqrt(X * X + Y * Y + Z * Z); }
	bool Equals(const FVector& o, double Tolerance) const { return std::fabs(X - o.X) <= Tolerance && std::fabs(Y - o.Y) <= Tolerance && std::fabs(Z - o.Z) <= Tolerance; }
	static FVector CrossProduct(const FVector& a, const FVector& b) { return { a.Y * b.Z - a.Z * b.Y, a.Z * b.X - a.X * b.Z, a.X * b.Y - a.Y * b.X }; }
};
inline const FVector FVector::ZeroVector{};
inline const FVector FVector::UpVector{ 0, 0, 1 };

struct FQuat
{
	double X = 0, Y = 0, Z = 0, W = 1;
	FQuat() = default;
	FQuat(FVector Axe, double AngleRad) { (void)Axe; (void)AngleRad; }
	static const FQuat Identity;
	FQuat operator*(const FQuat&) const { return *this; }
	void Normalize() {}
};
inline const FQuat FQuat::Identity{};

struct FRotator
{
	double Pitch = 0, Yaw = 0, Roll = 0;
	FRotator() = default;
	FRotator(double p, double y, double r) : Pitch(p), Yaw(y), Roll(r) {}
	FQuat Quaternion() const { return FQuat(); }
};

struct FTransform
{
	static const FTransform Identity;
	FVector TransformPosition(const FVector& v) const { return v; }
	FVector TransformVector(const FVector& v) const { return v; }
	FVector InverseTransformPosition(const FVector& v) const { return v; }
	FRotator Rotator() const { return FRotator(); }
	FVector GetLocation() const { return FVector(); }
};
inline const FTransform FTransform::Identity{};

struct FLinearColor
{
	float R, G, B, A;
	FLinearColor(float r, float g, float b, float a = 1.f) : R(r), G(g), B(b), A(a) {}
};

// --- objets
class UClass;
class UWorld;
class UObject
{
public:
	virtual ~UObject() = default;
	virtual UWorld* GetWorld() const { return nullptr; }
};
template <typename T> T* Cast(UObject* o) { return dynamic_cast<T*>(o); }
template <typename T> const T* Cast(const UObject* o) { return dynamic_cast<const T*>(o); }
template <typename T> T* NewObject(UObject* Outer, FName Name) { (void)Outer; (void)Name; return new T(); }

template <typename T>
class TObjectPtr
{
public:
	TObjectPtr() = default;
	TObjectPtr(T* x) : p(x) {}
	TObjectPtr& operator=(T* x) { p = x; return *this; }
	T* Get() const { return p; }
	T* operator->() const { return p; }
	operator T*() const { return p; }
	explicit operator bool() const { return p != nullptr; }
private:
	T* p = nullptr;
};

template <typename T>
class TWeakObjectPtr
{
public:
	TWeakObjectPtr() = default;
	TWeakObjectPtr(T* x) : p(x) {}
	TWeakObjectPtr& operator=(T* x) { p = x; return *this; }
	T* Get() const { return p; }
private:
	T* p = nullptr;
};

template <typename T>
class TSubclassOf
{
public:
	TSubclassOf() = default;
	TSubclassOf(UClass* c) : k(c) {}
	UClass* Get() const { return k; }
	operator UClass*() const { return k; }
private:
	UClass* k = nullptr;
};

// --- modules
class IModuleInterface { public: virtual ~IModuleInterface() = default; };
class FDefaultModuleImpl : public IModuleInterface {};
class FDefaultGameModuleImpl : public FDefaultModuleImpl {};
#define IMPLEMENT_MODULE(Classe, Nom) static Classe* Module_##Nom = nullptr
#define IMPLEMENT_PRIMARY_GAME_MODULE(Classe, Nom, Texte) static Classe* ModuleJeu_##Nom = nullptr

// --- fichiers
struct FPaths
{
	static FString ProjectContentDir() { return FString(); }
	static bool IsRelative(const FString&) { return true; }
	template <typename... A> static FString Combine(A&&...) { return FString(); }
};
class IFileManager
{
public:
	static IFileManager& Get() { static IFileManager f; return f; }
	void FindFiles(TArray<FString>& FoundFiles, const TCHAR* Directory, const TCHAR* FileExtension) { (void)FoundFiles; (void)Directory; (void)FileExtension; }
	void FindFiles(TArray<FString>& FileNames, const TCHAR* Filename, bool Files, bool Directories) { (void)FileNames; (void)Filename; (void)Files; (void)Directories; }
};
struct FFileHelper
{
	static bool LoadFileToArray(TArray<uint8>& Result, const TCHAR* Filename, uint32 Flags) { (void)Result; (void)Filename; (void)Flags; return false; }
};

// --- moteur
enum ETickingGroup { TG_PrePhysics, TG_StartPhysics, TG_DuringPhysics, TG_EndPhysics, TG_PostPhysics, TG_PostUpdateWork };
enum ELevelTick { LEVELTICK_TimeOnly, LEVELTICK_ViewportsOnly, LEVELTICK_All, LEVELTICK_PauseTick };
enum class ETeleportType : uint8 { None, TeleportPhysics, ResetPhysics };
namespace EEndPlayReason { enum Type { Destroyed, LevelTransition, EndPlayInEditor, RemovedFromWorld, Quit }; }
namespace ECollisionEnabled { enum Type { NoCollision, QueryOnly, PhysicsOnly, QueryAndPhysics }; }
enum class ESpawnActorCollisionHandlingMethod : uint8 { Undefined, AlwaysSpawn, AdjustIfPossibleButAlwaysSpawn, AdjustIfPossibleButDontSpawnIfColliding, DontSpawnIfColliding };
struct FHitResult {};
struct FTickFunction { bool bCanEverTick = false; ETickingGroup TickGroup = TG_PrePhysics; };
struct FActorTickFunction : FTickFunction {};
struct FActorComponentTickFunction : FTickFunction {};

class AActor;
class UActorComponent : public UObject
{
public:
	FActorComponentTickFunction PrimaryComponentTick;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) { (void)DeltaTime; (void)TickType; (void)ThisTickFunction; }
	AActor* GetOwner() const { return nullptr; }
	void RegisterComponent() {}
	void SetComponentTickEnabled(bool) {}
	// « Make this component tick after PrerequisiteActor » (référence Python 5.8 : add_tick_prerequisite_actor)
	virtual void AddTickPrerequisiteActor(AActor* PrerequisiteActor) { (void)PrerequisiteActor; }
};
class USceneComponent : public UActorComponent
{
public:
	void SetRelativeLocationAndRotation(FVector NewLocation, FRotator NewRotation) { (void)NewLocation; (void)NewRotation; }
	virtual FVector GetSocketLocation(FName InSocketName) const { (void)InSocketName; return FVector(); }
	FVector GetComponentLocation() const { return FVector(); }
};
class UPrimitiveComponent : public USceneComponent
{
public:
	void SetCollisionEnabled(ECollisionEnabled::Type) {}
	// « Set custom primitive data at index DataIndex » (UPrimitiveComponent, 5.8)
	void SetCustomPrimitiveDataFloat(int32 DataIndex, float Value) { (void)DataIndex; (void)Value; }
};
class UStaticMeshComponent : public UPrimitiveComponent {};
class UCapsuleComponent : public UPrimitiveComponent
{
public:
	void InitCapsuleSize(float InRadius, float InHalfHeight) { (void)InRadius; (void)InHalfHeight; }
	float GetScaledCapsuleHalfHeight() const { return 0.f; }
};
class USkeletalMesh : public UObject {};
class UAnimInstance;
class USkeletalMeshComponent : public UPrimitiveComponent
{
public:
	virtual void SetSkeletalMesh(USkeletalMesh* NewMesh, bool bReinitPose) { (void)NewMesh; (void)bReinitPose; }
	virtual void SetAnimInstanceClass(UClass* NewClass) { (void)NewClass; }
	UAnimInstance* GetAnimInstance() const { return nullptr; }
	int32 GetBoneIndex(FName BoneName) const { (void)BoneName; return 0; }
};
class UPawnMovementComponent : public UActorComponent {};
class UCharacterMovementComponent : public UPawnMovementComponent
{
public:
	virtual void DisableMovement() {}
};

struct FActorSpawnParameters
{
	ESpawnActorCollisionHandlingMethod SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::Undefined;
};

class AActor : public UObject
{
public:
	FActorTickFunction PrimaryActorTick;
	virtual void Tick(float DeltaSeconds) { (void)DeltaSeconds; }
	virtual void BeginPlay() {}
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) { (void)EndPlayReason; }
	virtual FVector GetVelocity() const { return FVector(); }
	bool SetActorLocationAndRotation(FVector NewLocation, FRotator NewRotation, bool bSweep, FHitResult* OutSweepHitResult, ETeleportType Teleport) { (void)NewLocation; (void)NewRotation; (void)bSweep; (void)OutSweepHitResult; (void)Teleport; return true; }
	bool SetActorLocationAndRotation(FVector NewLocation, const FQuat& NewRotation, bool bSweep, FHitResult* OutSweepHitResult, ETeleportType Teleport) { (void)NewLocation; (void)NewRotation; (void)bSweep; (void)OutSweepHitResult; (void)Teleport; return true; }
	void SetActorScale3D(FVector NewScale3D) { (void)NewScale3D; }
	virtual void SetActorHiddenInGame(bool bNewHidden) { (void)bNewHidden; }
	bool IsHidden() const { return false; }
	FVector GetActorLocation() const { return FVector(); }
	FRotator GetActorRotation() const { return FRotator(); }
	FTransform GetActorTransform() const { return FTransform(); }
	virtual void AddTickPrerequisiteActor(AActor* PrerequisiteActor) { (void)PrerequisiteActor; }
	bool Destroy() { return true; }
	bool SetRootComponent(USceneComponent* NewRootComponent) { (void)NewRootComponent; return true; }
	template <typename T> T* FindComponentByClass() const { return nullptr; }
	// AActor::GetComponents(TArray<ComponentType*, AllocatorType>&, bool bIncludeFromChildActors = false) const
	template <typename T> void GetComponents(TArray<T*>& OutComponents, bool bIncludeFromChildActors = false) const { (void)OutComponents; (void)bIncludeFromChildActors; }
	template <typename T> T* CreateDefaultSubobject(FName Name) { (void)Name; return new T(); }
};
class APawn : public AActor
{
public:
	virtual FVector GetVelocity() const override { return FVector(); }
};
class ACharacter : public APawn
{
public:
	UCapsuleComponent* GetCapsuleComponent() const { return nullptr; }
	USkeletalMeshComponent* GetMesh() const { return nullptr; }
	UCharacterMovementComponent* GetCharacterMovement() const { return nullptr; }
};
class ASpectatorPawn : public APawn { public: static UClass* StaticClass() { return nullptr; } };

class USubsystem : public UObject
{
public:
	virtual void Deinitialize() {}
};
class UWorldSubsystem : public USubsystem {};

class UWorld : public UObject
{
public:
	template <typename T> T* GetSubsystem() const { return nullptr; }
	template <typename T> T* SpawnActor(UClass* Class, const FTransform& Transform, const FActorSpawnParameters& SpawnParameters) { (void)Class; (void)Transform; (void)SpawnParameters; return nullptr; }
};

template <typename T>
class TActorIterator
{
public:
	explicit TActorIterator(const UWorld* World) { (void)World; }
	explicit operator bool() const { return false; }
	TActorIterator& operator++() { return *this; }
	T* operator*() const { return nullptr; }
};

class UDataAsset : public UObject {};

// --- animation
struct FTransformTrajectorySample
{
	FQuat Facing;
	FVector Position;
	float TimeInSeconds = 0.f;
};
struct FTransformTrajectory
{
	TArray<FTransformTrajectorySample> Samples;
};
class UAnimInstance : public UObject
{
public:
	virtual void NativeInitializeAnimation() {}
	virtual void NativeUpdateAnimation(float DeltaSeconds) { (void)DeltaSeconds; }
	APawn* TryGetPawnOwner() const { return nullptr; }
};

// --- HUD
class UFont : public UObject {};
class UCanvas : public UObject { public: float ClipX = 0.f; float ClipY = 0.f; };
class AHUD : public AActor
{
public:
	TObjectPtr<UCanvas> Canvas;
	virtual void DrawHUD() {}
	void DrawText(const FString& Text, FLinearColor TextColor, float ScreenX, float ScreenY, UFont* Font, float Scale, bool bScalePosition) { (void)Text; (void)TextColor; (void)ScreenX; (void)ScreenY; (void)Font; (void)Scale; (void)bScalePosition; }
	FVector Project(FVector Location, bool bClampToZeroPlane) const { (void)Location; (void)bClampToZeroPlane; return FVector(); }
};
class UEngine : public UObject { public: static UFont* GetSmallFont() { return nullptr; } };
inline UEngine* GEngine = nullptr;

class AGameModeBase : public AActor
{
public:
	TSubclassOf<APawn> DefaultPawnClass;
	TSubclassOf<AHUD> HUDClass;
};

struct UGameplayStatics
{
	static void SetGlobalTimeDilation(const UObject* WorldContextObject, float TimeDilation) { (void)WorldContextObject; (void)TimeDilation; }
};

// --- tests d'automatisation
enum class EAutomationTestFlags : uint64 { EditorContext = 1, ClientContext = 2, ServerContext = 4, CommandletContext = 8, EngineFilter = 1ull << 30 };
inline EAutomationTestFlags operator|(EAutomationTestFlags a, EAutomationTestFlags b) { return static_cast<EAutomationTestFlags>(static_cast<uint64>(a) | static_cast<uint64>(b)); }
class FAutomationTestBase
{
public:
	virtual ~FAutomationTestBase() = default;
	bool TestTrue(const TCHAR* What, bool Value) { (void)What; return Value; }
	bool TestTrue(const FString& What, bool Value) { (void)What; return Value; }
	bool TestEqual(const TCHAR* What, int32 Actual, int32 Expected) { (void)What; return Actual == Expected; }
	bool TestEqual(const TCHAR* What, float Actual, float Expected, float Tolerance) { (void)What; return std::fabs(Actual - Expected) <= Tolerance; }
	void AddError(const FString& InError) { (void)InError; }
};
#define IMPLEMENT_SIMPLE_AUTOMATION_TEST(Classe, Nom, Drapeaux) \
	class Classe : public FAutomationTestBase \
	{ \
	public: \
		bool RunTest(const FString& Parameters); \
		EAutomationTestFlags Flags() const { return Drapeaux; } \
	};
