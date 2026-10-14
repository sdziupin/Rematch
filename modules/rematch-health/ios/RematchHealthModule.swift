import ExpoModulesCore
import HealthKit

/// A finished REMATCH session, as JavaScript hands it over. Times are epoch milliseconds.
struct WorkoutRecord: Record {
  @Field var start: Double = 0
  @Field var end: Double = 0
  @Field var activity: String = "hiit"
  @Field var energyKcal: Double? = nil
  /// [pausedAt, resumedAt] pairs; a pause with no resume runs to `end`.
  @Field var pauses: [[Double]] = []
  @Field var externalId: String = ""
  @Field var title: String = ""
}

public class RematchHealthModule: Module {
  private lazy var store = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("RematchHealth")

    Function("isAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    /// Only write access can be checked: HealthKit never says whether reading was allowed.
    Function("getAuthorizationStatus") { () -> String in
      self.workoutStatus()
    }

    AsyncFunction("requestAuthorization") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.resolve("unavailable")
        return
      }
      var share: Set<HKSampleType> = [HKObjectType.workoutType()]
      if let energy = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
        share.insert(energy)
      }
      var read: Set<HKObjectType> = []
      if let mass = HKQuantityType.quantityType(forIdentifier: .bodyMass) {
        read.insert(mass)
      }
      self.store.requestAuthorization(toShare: share, read: read) { _, error in
        if let error = error {
          promise.reject("ERR_HEALTH_AUTH", error.localizedDescription)
          return
        }
        promise.resolve(self.workoutStatus())
      }
    }

    /// Most recent body mass in kilograms, or nil when there is none (or reading isn't allowed).
    AsyncFunction("getBodyMassKg") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable(),
            let mass = HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
        promise.resolve(nil as Double?)
        return
      }
      let newest = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
      let query = HKSampleQuery(sampleType: mass, predicate: nil, limit: 1, sortDescriptors: [newest]) { _, samples, _ in
        let kg = (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: .gramUnit(with: .kilo))
        promise.resolve(kg)
      }
      self.store.execute(query)
    }

    AsyncFunction("saveWorkout") { (workout: WorkoutRecord, promise: Promise) in
      self.save(workout, promise: promise)
    }
  }

  private func workoutStatus() -> String {
    guard HKHealthStore.isHealthDataAvailable() else { return "unavailable" }
    switch store.authorizationStatus(for: HKObjectType.workoutType()) {
    case .sharingAuthorized: return "authorized"
    case .sharingDenied: return "denied"
    default: return "notDetermined"
    }
  }

  private static func activityType(_ name: String) -> HKWorkoutActivityType {
    switch name {
    case "functionalStrength": return .functionalStrengthTraining
    case "coreTraining": return .coreTraining
    case "flexibility": return .flexibility
    case "mixedCardio": return .mixedCardio
    case "crossTraining": return .crossTraining
    default: return .highIntensityIntervalTraining
    }
  }

  private func save(_ workout: WorkoutRecord, promise: Promise) {
    guard HKHealthStore.isHealthDataAvailable() else {
      promise.reject("ERR_HEALTH_UNAVAILABLE", "Health data is not available on this device.")
      return
    }
    let start = Date(timeIntervalSince1970: workout.start / 1000)
    let end = Date(timeIntervalSince1970: workout.end / 1000)
    guard end > start else {
      promise.reject("ERR_HEALTH_RANGE", "A workout must end after it starts.")
      return
    }

    let configuration = HKWorkoutConfiguration()
    configuration.activityType = Self.activityType(workout.activity)
    configuration.locationType = .indoor
    let builder = HKWorkoutBuilder(healthStore: store, configuration: configuration, device: .local())

    var events: [HKWorkoutEvent] = []
    for pair in workout.pauses where pair.count >= 1 {
      let paused = Date(timeIntervalSince1970: pair[0] / 1000)
      guard paused > start, paused < end else { continue }
      events.append(HKWorkoutEvent(type: .pause, dateInterval: DateInterval(start: paused, duration: 0), metadata: nil))
      if pair.count >= 2 {
        let resumed = Date(timeIntervalSince1970: pair[1] / 1000)
        if resumed > paused, resumed < end {
          events.append(HKWorkoutEvent(type: .resume, dateInterval: DateInterval(start: resumed, duration: 0), metadata: nil))
        }
      }
    }

    var metadata: [String: Any] = [HKMetadataKeyIndoorWorkout: true]
    if !workout.externalId.isEmpty { metadata[HKMetadataKeyExternalUUID] = workout.externalId }
    if !workout.title.isEmpty { metadata[HKMetadataKeyWorkoutBrandName] = workout.title }

    var samples: [HKSample] = []
    if let kcal = workout.energyKcal, kcal > 0,
       let energy = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned),
       store.authorizationStatus(for: energy) == .sharingAuthorized {
      samples.append(HKQuantitySample(type: energy, quantity: HKQuantity(unit: .kilocalorie(), doubleValue: kcal), start: start, end: end))
    }

    let fail: (Error?) -> Void = { error in
      builder.discardWorkout()
      promise.reject("ERR_HEALTH_SAVE", error?.localizedDescription ?? "The workout could not be saved.")
    }

    builder.beginCollection(withStart: start) { ok, error in
      guard ok else { return fail(error) }
      // Energy and pauses are extras: the workout is still worth saving without them.
      builder.add(samples) { _, _ in
        builder.addWorkoutEvents(events) { _, _ in
          builder.addMetadata(metadata) { _, _ in
            builder.endCollection(withEnd: end) { ok, error in
              guard ok else { return fail(error) }
              builder.finishWorkout { saved, error in
                guard let saved = saved else { return fail(error) }
                promise.resolve(saved.uuid.uuidString)
              }
            }
          }
        }
      }
    }
  }
}
