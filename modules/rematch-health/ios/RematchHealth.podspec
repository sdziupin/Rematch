Pod::Spec.new do |s|
  s.name           = 'RematchHealth'
  s.version        = '1.0.0'
  s.summary        = 'Writes REMATCH workouts to Apple Health.'
  s.description    = 'A small HealthKit bridge: authorization, body mass, and saving finished workouts.'
  s.author         = 'REMATCH'
  s.homepage       = 'https://github.com/sdziupin/Rematch'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/sdziupin/Rematch.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
