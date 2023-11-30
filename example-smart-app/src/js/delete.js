$(document).on('click', '.btn.btn-outline-danger', function() {
    var medicationOrderId = this.id; // The id of the button is the MedicationOrder resource id
  
    smartClient.patient.api.delete({
      type: 'MedicationOrder',
      id: medicationOrderId,
    }).then(function(response) {
      // The medication order was successfully deleted
      console.log('Medication order deleted:', response);
  
      // Optionally, remove the row from the table
      $('#' + medicationOrderId).closest('tr').remove();
    },function(error) {
      // An error occurred
      console.error('Error deleting medication order:', error);
    });
  });