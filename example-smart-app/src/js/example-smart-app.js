(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      code: {
                        $or: ['http://loinc.org|8302-2', 'http://loinc.org|8462-4',
                              'http://loinc.org|8480-6', 'http://loinc.org|2085-9',
                              'http://loinc.org|2089-1', 'http://loinc.org|55284-4']
                      }
                    }
                  });
        var med = smart.patient.api.fetchAll({
          type: 'MedicationOrder', // Use 'MedicationOrder' for DSTU2
        });
        $.when(pt, obv, med).fail(onError);

        $.when(pt, obv, med).done(async function(patient, obv, med) {
          var byCodes = smart.byCodes(obv, 'code');
          var gender = patient.gender;

          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var p = defaultPatient();
          p.medicationOrders = med;
          console.log(med);
          p.birthdate = patient.birthDate;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          // Get list of prescribed medication
          med.forEach(function(medicationOrder) {
          prescribedMedication.push(medicationOrder.medicationCodeableConcept.coding.code);
          });
          console.log(prescribedMedication);
          
          // Get list of drug pairs for currently prescribed medication
          var drugPairs = [];
          for (let i = 0; i < prescribedDrugs.length; i++) {
            for (let j = i + 1; j < prescribedDrugs.length; j++) {
              drugPairs.push([prescribedDrugs[i], prescribedDrugs[j]]);
            }
          }
          console.log(drugPairs);

          let interactingDrugs = [];

          // Check for drug interactions
          for (let pair of drugPairs) {
            let response = await fetch(`https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${pair[0]}+${pair[1]}`);
          
            if (response.ok) {
              let data = await response.json();
          
              if (data.fullInteractionTypeGroup) {
                interactingDrugs.push(pair);
                p.interactingDrugs.push(data.fullInteractionTypeGroup[0].fullInteractionType[0].interactionPair[0].description);
              }
            }
          }
          console.log(interactingDrugs);
          console.log(p.interactingDrugs);
          ret.resolve(p);

          

          $.when(pt, obv, med).fail(onError);
        });


      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
      medicationOrders: {value: []},
      prescribedMedication: {value: []},
      interactingDrugs: {value: []}
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

  window.drawVisualization = function(p) {
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname); 
    $('#lname').html(p.lname);
    $('#fullname').html(p.fname + ' ' + p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);

    p.medicationOrders.forEach(function(medicationOrder) {
      var medicationName = medicationOrder.medicationCodeableConcept.text;
      var medicationQuantity = medicationOrder.dispenseRequest.quantity.value + ' ' + medicationOrder.dispenseRequest.quantity.unit.replace(/{|}/g, '');
      var medicationDirection = medicationOrder.dosageInstruction[0].text;
      var medicationDuration = medicationOrder.dispenseRequest.expectedSupplyDuration.value + ' ' + medicationOrder.dispenseRequest.expectedSupplyDuration.unit.replace(/{|}/g, '');

      var html = `
        <tr>
          <td>${medicationName}</td>
          <td>${medicationQuantity}</td>
          <td>${medicationDirection}</td>
          <td>${medicationDuration}</td>
          </tr>
      `;
      $('#medicationTable').append(html);
    });
  };

})(window);
